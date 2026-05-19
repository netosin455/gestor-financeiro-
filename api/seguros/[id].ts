// GET    /api/seguros/:id  — buscar seguro
// PUT    /api/seguros/:id  — atualizar seguro
// DELETE /api/seguros/:id  — desativar seguro (active = false)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  parseBody, NotFoundError, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    checkPermission(user, ['super_admin', 'admin', 'financeiro'])

    const db = getDb()
    const { id } = req.query as { id: string }

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      throw new ValidationError('ID inválido')
    }

    const rows = await db`
      SELECT s.*, f.nome AS frota_nome, f.placa AS frota_placa
      FROM seguros s
      LEFT JOIN frota f ON f.id = s.frota_id
      WHERE s.id = ${id}::uuid
      LIMIT 1
    `

    if (rows.length === 0) throw new NotFoundError('Seguro não encontrado')
    const seguro = rows[0]

    // --------------------------------------------------
    // GET
    // --------------------------------------------------
    if (req.method === 'GET') {
      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: seguro })
    }

    // --------------------------------------------------
    // PUT — Atualizar
    // --------------------------------------------------
    if (req.method === 'PUT') {
      const body = await parseBody<Record<string, unknown>>(req as unknown as import('http').IncomingMessage)

      const {
        frota_id, proprietario, valor_parcela, num_parcelas,
        data_vencimento, forma_pagamento, corretora, local_debito, seguradora,
      } = body as {
        frota_id?: string; proprietario?: string; valor_parcela?: number
        num_parcelas?: number; data_vencimento?: string; forma_pagamento?: string
        corretora?: string; local_debito?: string; seguradora?: string
      }

      if (valor_parcela !== undefined && (typeof valor_parcela !== 'number' || valor_parcela <= 0)) {
        throw new ValidationError('valor_parcela deve ser um número positivo')
      }
      if (num_parcelas !== undefined && (typeof num_parcelas !== 'number' || num_parcelas <= 0)) {
        throw new ValidationError('num_parcelas deve ser um número positivo')
      }
      if (data_vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
        throw new ValidationError('data_vencimento deve estar no formato YYYY-MM-DD')
      }

      const [atualizado] = await db`
        UPDATE seguros SET
          frota_id        = COALESCE(${frota_id        ?? null}::uuid,  frota_id),
          proprietario    = COALESCE(${proprietario    ?? null},         proprietario),
          valor_parcela   = COALESCE(${valor_parcela   ?? null},         valor_parcela),
          num_parcelas    = COALESCE(${num_parcelas    ?? null},         num_parcelas),
          data_vencimento = COALESCE(${data_vencimento ?? null}::date,   data_vencimento),
          forma_pagamento = COALESCE(${forma_pagamento ?? null},         forma_pagamento),
          corretora       = COALESCE(${corretora       ?? null},         corretora),
          local_debito    = COALESCE(${local_debito    ?? null},         local_debito),
          seguradora      = COALESCE(${seguradora      ?? null},         seguradora)
        WHERE id = ${id}::uuid
        RETURNING *
      `

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: atualizado })
    }

    // --------------------------------------------------
    // DELETE — Soft delete via active = false
    // --------------------------------------------------
    if (req.method === 'DELETE') {
      checkPermission(user, ['super_admin', 'admin'])

      await db`UPDATE seguros SET active = false WHERE id = ${id}::uuid`

      return sendJson(res as unknown as import('http').ServerResponse, 200, {
        data: { message: 'Seguro desativado com sucesso' },
      })
    }

    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
