// GET /api/relatorios/por-unidade?mes=YYYY-MM
// Comparativo de gastos entre unidades no mês

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, handleError, sendJson,
  checkPermission, mesAtual, mesAnterior, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    // Gestor não tem visão cross-unidade
    checkPermission(user, ['super_admin', 'admin', 'financeiro'])

    const db  = getDb()
    const q   = req.query as Record<string, string>
    const mes = q.mes ?? mesAtual()

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const mesAnt = mesAnterior(mes)

    const [mesAtualRows, mesAntRows] = await Promise.all([
      db`
        SELECT
          u.id,
          u.nome,
          u.tipo,
          COALESCE(SUM(l.valor), 0) AS valor,
          COUNT(l.id)               AS qtd
        FROM unidades u
        LEFT JOIN lancamentos l
          ON l.unidade_id = u.id
          AND l.mes_referencia = ${mes}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
        WHERE u.active = true
        GROUP BY u.id, u.nome, u.tipo
        ORDER BY valor DESC
      `,
      db`
        SELECT
          u.id,
          COALESCE(SUM(l.valor), 0) AS valor
        FROM unidades u
        LEFT JOIN lancamentos l
          ON l.unidade_id = u.id
          AND l.mes_referencia = ${mesAnt}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
        WHERE u.active = true
        GROUP BY u.id
      `,
    ])

    const antMap = new Map(
      (mesAntRows as { id: string; valor: string }[]).map(r => [r.id, Number(r.valor)])
    )

    const unidades = (mesAtualRows as {
      id: string; nome: string; tipo: string; valor: string; qtd: string
    }[]).map(r => {
      const valorAtual = Number(r.valor)
      const valorAnt   = antMap.get(r.id) ?? 0
      const variacao   = valorAnt > 0
        ? ((valorAtual - valorAnt) / valorAnt) * 100
        : null
      return {
        id:               r.id,
        nome:             r.nome,
        tipo:             r.tipo,
        valor:            valorAtual,
        qtd:              Number(r.qtd),
        valorMesAnterior: valorAnt,
        variacaoPercent:  variacao !== null ? Math.round(variacao * 10) / 10 : null,
      }
    })

    return sendJson(res as unknown as import('http').ServerResponse, 200, {
      data: { mes, mesAnterior: mesAnt, unidades },
    })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
