// GET /api/alertas?dias=7           — vencimentos próximos
// GET /api/alertas?modo=calendario&mes=YYYY-MM — lançamentos do mês para o calendário

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
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    const db   = getDb()
    const q    = req.query as Record<string, string>

    // ------ Modo calendário ------
    if (q.modo === 'calendario') {
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
          c.nome AS categoria,
          c.cor  AS categoria_cor
        FROM lancamentos l
        JOIN categorias c ON c.id = l.categoria_id
        WHERE l.deleted_at     IS NULL
          AND l.status        != 'cancelado'
          AND l.mes_referencia = ${mes}
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        ORDER BY COALESCE(l.data_vencimento, l.data_pagamento) ASC, l.valor DESC
      `

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: rows })
    }

    // ------ Modo alertas (padrão) ------
    const dias      = Math.min(30, Math.max(1, parseInt(q.dias ?? '7', 10)))
    const unidadeId = getUnidadeFiltro(user, q.unidadeId)

    const rows = await db`
      SELECT
        l.id,
        l.descricao,
        l.valor,
        l.data_vencimento,
        l.status,
        l.unidade_id,
        c.nome AS categoria,
        u.nome AS unidade_nome,
        (l.data_vencimento - CURRENT_DATE) AS dias_restantes,
        CASE
          WHEN l.data_vencimento < CURRENT_DATE  THEN 'atrasado'
          WHEN l.data_vencimento = CURRENT_DATE  THEN 'vence_hoje'
          ELSE 'vencendo'
        END AS urgencia
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      LEFT JOIN unidades u ON u.id = l.unidade_id
      WHERE l.data_vencimento BETWEEN CURRENT_DATE - INTERVAL '1 day'
                                  AND CURRENT_DATE + (${dias} || ' days')::INTERVAL
        AND l.status = 'pendente'
        AND l.deleted_at IS NULL
        ${unidadeId ? db`AND l.unidade_id = ${unidadeId}::uuid` : db``}
      ORDER BY l.data_vencimento ASC
    `

    return sendJson(res as unknown as import('http').ServerResponse, 200, {
      data: rows,
      total: rows.length,
    })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
