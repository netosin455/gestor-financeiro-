// GET /api/calendario?mes=YYYY-MM
// Retorna lançamentos do mês com data_vencimento ou data_pagamento

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, handleError, sendJson,
  getUnidadeFiltro, mesAtual, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const user      = requireAuth(req as unknown as import('http').IncomingMessage)
    const db        = getDb()
    const q         = req.query as Record<string, string>
    const mes       = q.mes ?? mesAtual()
    const unidadeId = getUnidadeFiltro(user, q.unidadeId)

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const rows = await db`
      SELECT
        l.id,
        l.descricao,
        l.valor,
        l.status,
        l.pago,
        l.data_vencimento,
        l.data_pagamento,
        c.nome  AS categoria,
        c.cor   AS categoria_cor
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      WHERE l.deleted_at  IS NULL
        AND l.status      != 'cancelado'
        AND l.mes_referencia = ${mes}
        AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
      ORDER BY COALESCE(l.data_vencimento, l.data_pagamento) ASC, l.valor DESC
    `

    return sendJson(res as unknown as import('http').ServerResponse, 200, { data: rows })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
