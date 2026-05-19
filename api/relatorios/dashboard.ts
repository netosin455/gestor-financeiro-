// GET /api/relatorios/dashboard?mes=YYYY-MM
// Retorna todos os KPIs do dashboard em uma única chamada

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, handleError, sendJson,
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

    const q          = req.query as Record<string, string>
    const mes        = q.mes ?? mesAtual()
    const unidadeId  = getUnidadeFiltro(user, q.unidadeId)

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const mesAnt = mesAnterior(mes)

    // Executa todas as queries em paralelo para performance
    const [
      totalMesRows,
      totalAntRows,
      porCategoriaRows,
      porUnidadeRows,
      top5Rows,
      alertasRows,
      statusRows,
    ] = await Promise.all([

      // 1. Total do mês atual
      db`
        SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS qtd
        FROM lancamentos
        WHERE mes_referencia = ${mes}
          AND deleted_at IS NULL
          AND status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR unidade_id = ${unidadeId ?? null}::uuid)
      `,

      // 2. Total do mês anterior
      db`
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM lancamentos
        WHERE mes_referencia = ${mesAnt}
          AND deleted_at IS NULL
          AND status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR unidade_id = ${unidadeId ?? null}::uuid)
      `,

      // 3. Gastos por categoria
      db`
        SELECT
          c.nome,
          c.cor,
          COALESCE(SUM(l.valor), 0) AS valor
        FROM lancamentos l
        JOIN categorias c ON c.id = l.categoria_id
        WHERE l.mes_referencia = ${mes}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        GROUP BY c.id, c.nome, c.cor
        ORDER BY valor DESC
      `,

      // 4. Gastos por unidade
      db`
        SELECT
          COALESCE(u.nome, 'Sem unidade') AS nome,
          COALESCE(SUM(l.valor), 0)       AS valor
        FROM lancamentos l
        LEFT JOIN unidades u ON u.id = l.unidade_id
        WHERE l.mes_referencia = ${mes}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        GROUP BY u.nome
        ORDER BY valor DESC
      `,

      // 5. Top 5 maiores despesas
      db`
        SELECT
          l.descricao,
          l.valor,
          c.nome AS categoria
        FROM lancamentos l
        JOIN categorias c ON c.id = l.categoria_id
        WHERE l.mes_referencia = ${mes}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        ORDER BY l.valor DESC
        LIMIT 5
      `,

      // 6. Alertas de vencimento nos próximos 7 dias
      db`
        SELECT
          l.id,
          l.descricao,
          l.valor,
          l.data_vencimento,
          c.nome AS categoria,
          (l.data_vencimento - CURRENT_DATE) AS dias_restantes
        FROM lancamentos l
        JOIN categorias c ON c.id = l.categoria_id
        WHERE l.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
          AND l.status = 'pendente'
          AND l.deleted_at IS NULL
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        ORDER BY l.data_vencimento ASC
      `,

      // 7. Status de pagamentos do mês
      db`
        SELECT
          status,
          COUNT(*)                AS qtd,
          COALESCE(SUM(valor), 0) AS total
        FROM lancamentos
        WHERE mes_referencia = ${mes}
          AND deleted_at IS NULL
          AND status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR unidade_id = ${unidadeId ?? null}::uuid)
        GROUP BY status
      `,
    ])

    const totalMes      = Number(totalMesRows[0]?.total   ?? 0)
    const totalAnt      = Number(totalAntRows[0]?.total    ?? 0)
    const totalLancamentos = Number(totalMesRows[0]?.qtd  ?? 0)

    const variacaoPercent = totalAnt > 0
      ? ((totalMes - totalAnt) / totalAnt) * 100
      : 0

    const porCategoria = (porCategoriaRows as { nome: string; cor: string; valor: string }[]).map(r => ({
      nome:    r.nome as KpiDashboard['porCategoria'][0]['nome'],
      valor:   Number(r.valor),
      percent: totalMes > 0 ? (Number(r.valor) / totalMes) * 100 : 0,
      cor:     r.cor,
    }))

    const statusMap: Record<string, number> = {}
    let totalPendente = 0
    for (const row of statusRows as { status: string; qtd: string; total: string }[]) {
      statusMap[row.status] = Number(row.total)
      if (row.status !== 'pago') totalPendente += Number(row.total)
    }
    const totalPago     = statusMap['pago'] ?? 0
    const percentPago   = totalMes > 0 ? (totalPago / totalMes) * 100 : 0

    const kpi: KpiDashboard = {
      totalMes,
      totalMesAnterior: totalAnt,
      variacaoPercent:  Math.round(variacaoPercent * 10) / 10,
      porCategoria,
      porUnidade: (porUnidadeRows as { nome: string; valor: string }[]).map(r => ({
        nome:  r.nome,
        valor: Number(r.valor),
      })),
      top5Despesas: (top5Rows as { descricao: string; valor: string; categoria: string }[]).map(r => ({
        descricao: r.descricao,
        valor:     Number(r.valor),
        categoria: r.categoria as KpiDashboard['top5Despesas'][0]['categoria'],
      })),
      alertasVencimento: (alertasRows as {
        id: string; descricao: string; valor: string;
        data_vencimento: string; categoria: string; dias_restantes: string
      }[]).map(r => ({
        id:              r.id,
        descricao:       r.descricao,
        valor:           Number(r.valor),
        data_vencimento: r.data_vencimento,
        dias_restantes:  Number(r.dias_restantes),
        categoria:       r.categoria as KpiDashboard['alertasVencimento'][0]['categoria'],
      })),
      percentPago:    Math.round(percentPago * 10) / 10,
      totalPendente,
      totalLancamentos,
    }

    return sendJson(res as unknown as import('http').ServerResponse, 200, { data: kpi })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
