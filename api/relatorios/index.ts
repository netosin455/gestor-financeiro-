// GET /api/relatorios?tipo=dashboard&mes=YYYY-MM   — KPIs completos
// GET /api/relatorios?tipo=mensal&mes=YYYY-MM      — comparativo por categoria
// GET /api/relatorios?tipo=por-unidade&mes=YYYY-MM — comparativo entre unidades

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  getUnidadeFiltro, mesAtual, mesAnterior, ValidationError,
} from '../_lib'
import type { KpiDashboard } from '../../types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    const db   = getDb()
    const q    = req.query as Record<string, string>
    const tipo = q.tipo
    const mes  = q.mes ?? mesAtual()

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const mesAnt = mesAnterior(mes)

    // ──────────────────────────────────────────────────
    // DASHBOARD — KPIs completos
    // ──────────────────────────────────────────────────
    if (!tipo || tipo === 'dashboard') {
      const unidadeId = getUnidadeFiltro(user, q.unidadeId)

      const [
        totalMesRows, totalAntRows, porCategoriaRows,
        porUnidadeRows, top5Rows, alertasRows, statusRows,
      ] = await Promise.all([
        db`
          SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS qtd
          FROM lancamentos
          WHERE mes_referencia = ${mes} AND deleted_at IS NULL AND status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR unidade_id = ${unidadeId ?? null}::uuid)
        `,
        db`
          SELECT COALESCE(SUM(valor), 0) AS total
          FROM lancamentos
          WHERE mes_referencia = ${mesAnt} AND deleted_at IS NULL AND status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR unidade_id = ${unidadeId ?? null}::uuid)
        `,
        db`
          SELECT c.nome, c.cor, COALESCE(SUM(l.valor), 0) AS valor
          FROM lancamentos l
          JOIN categorias c ON c.id = l.categoria_id
          WHERE l.mes_referencia = ${mes} AND l.deleted_at IS NULL AND l.status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          GROUP BY c.id, c.nome, c.cor ORDER BY valor DESC
        `,
        db`
          SELECT COALESCE(u.nome, 'Sem unidade') AS nome, COALESCE(SUM(l.valor), 0) AS valor
          FROM lancamentos l
          LEFT JOIN unidades u ON u.id = l.unidade_id
          WHERE l.mes_referencia = ${mes} AND l.deleted_at IS NULL AND l.status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          GROUP BY u.nome ORDER BY valor DESC
        `,
        db`
          SELECT l.descricao, l.valor, c.nome AS categoria
          FROM lancamentos l
          JOIN categorias c ON c.id = l.categoria_id
          WHERE l.mes_referencia = ${mes} AND l.deleted_at IS NULL AND l.status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          ORDER BY l.valor DESC LIMIT 5
        `,
        db`
          SELECT l.id, l.descricao, l.valor, l.data_vencimento, c.nome AS categoria,
            (l.data_vencimento - CURRENT_DATE) AS dias_restantes
          FROM lancamentos l
          JOIN categorias c ON c.id = l.categoria_id
          WHERE l.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
            AND l.status = 'pendente' AND l.deleted_at IS NULL
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          ORDER BY l.data_vencimento ASC
        `,
        db`
          SELECT status, COUNT(*) AS qtd, COALESCE(SUM(valor), 0) AS total
          FROM lancamentos
          WHERE mes_referencia = ${mes} AND deleted_at IS NULL AND status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR unidade_id = ${unidadeId ?? null}::uuid)
          GROUP BY status
        `,
      ])

      const totalMes = Number(totalMesRows[0]?.total ?? 0)
      const totalAnt = Number(totalAntRows[0]?.total ?? 0)

      const porCategoria = (porCategoriaRows as { nome: string; cor: string; valor: string }[]).map(r => ({
        nome:    r.nome as KpiDashboard['porCategoria'][0]['nome'],
        valor:   Number(r.valor),
        percent: totalMes > 0 ? (Number(r.valor) / totalMes) * 100 : 0,
        cor:     r.cor,
      }))

      const statusMap: Record<string, number> = {}
      let totalPendente = 0
      for (const row of statusRows as { status: string; total: string }[]) {
        statusMap[row.status] = Number(row.total)
        if (row.status !== 'pago') totalPendente += Number(row.total)
      }
      const percentPago = totalMes > 0 ? ((statusMap['pago'] ?? 0) / totalMes) * 100 : 0

      const kpi: KpiDashboard = {
        totalMes,
        totalMesAnterior:  totalAnt,
        variacaoPercent:   Math.round(totalAnt > 0 ? ((totalMes - totalAnt) / totalAnt) * 100 * 10 / 10 : 0),
        porCategoria,
        porUnidade: (porUnidadeRows as { nome: string; valor: string }[]).map(r => ({ nome: r.nome, valor: Number(r.valor) })),
        top5Despesas: (top5Rows as { descricao: string; valor: string; categoria: string }[]).map(r => ({
          descricao: r.descricao, valor: Number(r.valor),
          categoria: r.categoria as KpiDashboard['top5Despesas'][0]['categoria'],
        })),
        alertasVencimento: (alertasRows as {
          id: string; descricao: string; valor: string; data_vencimento: string; categoria: string; dias_restantes: string
        }[]).map(r => ({
          id: r.id, descricao: r.descricao, valor: Number(r.valor),
          data_vencimento: r.data_vencimento, dias_restantes: Number(r.dias_restantes),
          categoria: r.categoria as KpiDashboard['alertasVencimento'][0]['categoria'],
        })),
        percentPago:    Math.round(percentPago * 10) / 10,
        totalPendente,
        totalLancamentos: Number(totalMesRows[0]?.qtd ?? 0),
      }

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: kpi })
    }

    // ──────────────────────────────────────────────────
    // MENSAL — comparativo por categoria
    // ──────────────────────────────────────────────────
    if (tipo === 'mensal') {
      const unidadeId = getUnidadeFiltro(user, q.unidadeId)

      const [mesAtualRows, mesAntRows] = await Promise.all([
        db`
          SELECT c.id, c.nome, c.grupo, c.cor,
            COALESCE(SUM(l.valor), 0) AS valor, COUNT(l.id) AS qtd
          FROM categorias c
          LEFT JOIN lancamentos l
            ON l.categoria_id = c.id AND l.mes_referencia = ${mes}
            AND l.deleted_at IS NULL AND l.status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          GROUP BY c.id, c.nome, c.grupo, c.cor ORDER BY valor DESC
        `,
        db`
          SELECT c.id, COALESCE(SUM(l.valor), 0) AS valor
          FROM categorias c
          LEFT JOIN lancamentos l
            ON l.categoria_id = c.id AND l.mes_referencia = ${mesAnt}
            AND l.deleted_at IS NULL AND l.status != 'cancelado'
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          GROUP BY c.id
        `,
      ])

      const antMap = new Map((mesAntRows as { id: string; valor: string }[]).map(r => [r.id, Number(r.valor)]))

      const categorias = (mesAtualRows as {
        id: string; nome: string; grupo: string; cor: string; valor: string; qtd: string
      }[]).map(r => {
        const valorAtual = Number(r.valor)
        const valorAnt   = antMap.get(r.id) ?? 0
        const variacao   = valorAnt > 0 ? ((valorAtual - valorAnt) / valorAnt) * 100 : null
        return {
          id: r.id, nome: r.nome, grupo: r.grupo, cor: r.cor,
          valor: valorAtual, qtd: Number(r.qtd), valorMesAnterior: valorAnt,
          variacaoPercent: variacao !== null ? Math.round(variacao * 10) / 10 : null,
        }
      })

      const totalMes = categorias.reduce((acc, c) => acc + c.valor, 0)
      const totalAnt = [...antMap.values()].reduce((acc, v) => acc + v, 0)

      return sendJson(res as unknown as import('http').ServerResponse, 200, {
        data: {
          mes, mesAnterior: mesAnt, totalMes, totalMesAnterior: totalAnt,
          variacaoPercent: totalAnt > 0 ? Math.round(((totalMes - totalAnt) / totalAnt) * 1000) / 10 : null,
          categorias,
        },
      })
    }

    // ──────────────────────────────────────────────────
    // POR-UNIDADE — comparativo entre unidades
    // ──────────────────────────────────────────────────
    if (tipo === 'por-unidade') {
      checkPermission(user, ['super_admin', 'admin', 'financeiro'])

      const [mesAtualRows, mesAntRows] = await Promise.all([
        db`
          SELECT u.id, u.nome, u.tipo,
            COALESCE(SUM(l.valor), 0) AS valor, COUNT(l.id) AS qtd
          FROM unidades u
          LEFT JOIN lancamentos l
            ON l.unidade_id = u.id AND l.mes_referencia = ${mes}
            AND l.deleted_at IS NULL AND l.status != 'cancelado'
          WHERE u.active = true
          GROUP BY u.id, u.nome, u.tipo ORDER BY valor DESC
        `,
        db`
          SELECT u.id, COALESCE(SUM(l.valor), 0) AS valor
          FROM unidades u
          LEFT JOIN lancamentos l
            ON l.unidade_id = u.id AND l.mes_referencia = ${mesAnt}
            AND l.deleted_at IS NULL AND l.status != 'cancelado'
          WHERE u.active = true
          GROUP BY u.id
        `,
      ])

      const antMap = new Map((mesAntRows as { id: string; valor: string }[]).map(r => [r.id, Number(r.valor)]))

      const unidades = (mesAtualRows as { id: string; nome: string; tipo: string; valor: string; qtd: string }[]).map(r => {
        const valorAtual = Number(r.valor)
        const valorAnt   = antMap.get(r.id) ?? 0
        const variacao   = valorAnt > 0 ? ((valorAtual - valorAnt) / valorAnt) * 100 : null
        return {
          id: r.id, nome: r.nome, tipo: r.tipo, valor: valorAtual, qtd: Number(r.qtd),
          valorMesAnterior: valorAnt,
          variacaoPercent: variacao !== null ? Math.round(variacao * 10) / 10 : null,
        }
      })

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: { mes, mesAnterior: mesAnt, unidades } })
    }

    throw new ValidationError('Parâmetro tipo inválido. Use: dashboard, mensal ou por-unidade')
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
