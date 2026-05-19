// GET /api/auditoria?lancamentoId=<uuid>
// Retorna histórico de alterações de um lançamento

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  parsePagination, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    checkPermission(user, ['super_admin', 'admin', 'financeiro'])

    const db  = getDb()
    const q   = req.query as Record<string, string>
    const { lancamentoId } = q

    if (!lancamentoId || !/^[0-9a-f-]{36}$/.test(lancamentoId)) {
      throw new ValidationError('lancamentoId inválido ou ausente')
    }

    const { limit, offset, page } = parsePagination(q)

    const rows = await db`
      SELECT
        h.id,
        h.lancamento_id,
        h.usuario_id,
        h.usuario_nome,
        h.acao,
        h.campo_alterado,
        h.valor_anterior,
        h.valor_novo,
        h.ip,
        h.created_at,
        COUNT(*) OVER() AS total_count
      FROM lancamentos_historico h
      WHERE h.lancamento_id = ${lancamentoId}::uuid
      ORDER BY h.created_at DESC
      LIMIT  ${limit}
      OFFSET ${offset}
    `

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0

    return sendJson(res as unknown as import('http').ServerResponse, 200, {
      data:       rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
