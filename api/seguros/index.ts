// GET  /api/seguros        — lista seguros com dados da frota
// POST /api/seguros        — cadastrar novo seguro

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  parseBody, requireFields, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    checkPermission(user, ['super_admin', 'admin', 'financeiro'])

    const db = getDb()

    // --------------------------------------------------
    // GET — Listar seguros
    // --------------------------------------------------
    if (req.method === 'GET') {
      const q      = req.query as Record<string, string>
      const active = q.active !== 'false' // padrão: só ativos

      const rows = await db`
        SELECT
          s.id,
          s.frota_id,
          f.nome           AS frota_nome,
          f.placa          AS frota_placa,
          s.proprietario,
          s.valor_parcela,
          s.num_parcelas,
          s.data_vencimento,
          s.forma_pagamento,
          s.corretora,
          s.local_debito,
          s.seguradora,
          s.active,
          s.created_at
        FROM seguros s
        LEFT JOIN frota f ON f.id = s.frota_id
        WHERE s.active = ${active}
        ORDER BY s.data_vencimento ASC NULLS LAST, s.created_at DESC
      `

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: rows })
    }

    // --------------------------------------------------
    // POST — Criar seguro
    // --------------------------------------------------
    if (req.method === 'POST') {
      const body = await parseBody<Record<string, unknown>>(req as unknown as import('http').IncomingMessage)

      requireFields(body, ['valor_parcela', 'num_parcelas'])

      const {
        frota_id, proprietario, valor_parcela, num_parcelas,
        data_vencimento, forma_pagamento, corretora, local_debito, seguradora,
      } = body as {
        frota_id?: string; proprietario?: string; valor_parcela: number
        num_parcelas: number; data_vencimento?: string; forma_pagamento?: string
        corretora?: string; local_debito?: string; seguradora?: string
      }

      if (typeof valor_parcela !== 'number' || valor_parcela <= 0) {
        throw new ValidationError('valor_parcela deve ser um número positivo')
      }
      if (typeof num_parcelas !== 'number' || num_parcelas <= 0) {
        throw new ValidationError('num_parcelas deve ser um número positivo')
      }
      if (data_vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(data_vencimento)) {
        throw new ValidationError('data_vencimento deve estar no formato YYYY-MM-DD')
      }

      if (frota_id) {
        const frota = await db`SELECT id FROM frota WHERE id = ${frota_id}::uuid AND active = true LIMIT 1`
        if (frota.length === 0) throw new ValidationError('frota_id não encontrada ou inativa')
      }

      const [novo] = await db`
        INSERT INTO seguros
          (frota_id, proprietario, valor_parcela, num_parcelas,
           data_vencimento, forma_pagamento, corretora, local_debito, seguradora)
        VALUES (
          ${frota_id        ?? null}::uuid,
          ${proprietario    ?? null},
          ${valor_parcela},
          ${num_parcelas},
          ${data_vencimento ?? null}::date,
          ${forma_pagamento ?? null},
          ${corretora       ?? null},
          ${local_debito    ?? null},
          ${seguradora      ?? null}
        )
        RETURNING *
      `

      return sendJson(res as unknown as import('http').ServerResponse, 201, { data: novo })
    }

    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
