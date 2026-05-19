// GET  /api/operacional?recurso=frota            — lista frota
// POST /api/operacional?recurso=frota            — criar veículo
// PUT  /api/operacional?recurso=frota&id=UUID    — atualizar veículo
// DELETE /api/operacional?recurso=frota&id=UUID  — desativar veículo
// GET  /api/operacional?recurso=motoristas       — lista motoristas

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  parseBody, requireFields, ValidationError, NotFoundError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user    = requireAuth(req as unknown as import('http').IncomingMessage)
    const db      = getDb()
    const q       = req.query as Record<string, string>
    const recurso = q.recurso

    // ──────────────────────────────────────────────────
    // FROTA
    // ──────────────────────────────────────────────────
    if (recurso === 'frota') {
      if (req.method === 'GET') {
        const active = q.active !== 'false'
        const rows = await db`
          SELECT
            f.id, f.nome, f.placa, f.proprietario, f.active, f.created_at,
            m.nome AS motorista_nome, m.id AS motorista_id
          FROM frota f
          LEFT JOIN motoristas m ON m.id::text = f.motorista_principal
          WHERE f.active = ${active}
          ORDER BY f.nome ASC
        `
        return sendJson(res as unknown as import('http').ServerResponse, 200, { data: rows })
      }

      if (req.method === 'POST') {
        checkPermission(user, ['super_admin', 'admin'])
        const body = await parseBody<Record<string, unknown>>(req as unknown as import('http').IncomingMessage)
        requireFields(body, ['nome'])

        const { nome, placa, proprietario, motorista_principal } = body as {
          nome: string; placa?: string; proprietario?: string; motorista_principal?: string
        }

        if (typeof nome !== 'string' || nome.trim().length === 0) {
          throw new ValidationError('nome é obrigatório')
        }

        const [novo] = await db`
          INSERT INTO frota (nome, placa, proprietario, motorista_principal)
          VALUES (
            ${nome.trim()},
            ${placa ?? null},
            ${proprietario ?? null},
            ${motorista_principal ?? null}
          )
          RETURNING *
        `
        return sendJson(res as unknown as import('http').ServerResponse, 201, { data: novo })
      }

      if (req.method === 'PUT') {
        checkPermission(user, ['super_admin', 'admin'])
        const { id } = q
        if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError('ID inválido')

        const body = await parseBody<Record<string, unknown>>(req as unknown as import('http').IncomingMessage)
        const { nome, placa, proprietario, motorista_principal, active } = body as {
          nome?: string; placa?: string; proprietario?: string
          motorista_principal?: string; active?: boolean
        }

        const existing = await db`SELECT id FROM frota WHERE id = ${id}::uuid LIMIT 1`
        if (existing.length === 0) throw new NotFoundError('Veículo não encontrado')

        const [atualizado] = await db`
          UPDATE frota SET
            nome                = COALESCE(${nome        ?? null}, nome),
            placa               = COALESCE(${placa       ?? null}, placa),
            proprietario        = COALESCE(${proprietario ?? null}, proprietario),
            motorista_principal = COALESCE(${motorista_principal ?? null}, motorista_principal),
            active              = COALESCE(${active      ?? null}, active)
          WHERE id = ${id}::uuid
          RETURNING *
        `
        return sendJson(res as unknown as import('http').ServerResponse, 200, { data: atualizado })
      }

      if (req.method === 'DELETE') {
        checkPermission(user, ['super_admin', 'admin'])
        const { id } = q
        if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new ValidationError('ID inválido')

        const existing = await db`SELECT id FROM frota WHERE id = ${id}::uuid LIMIT 1`
        if (existing.length === 0) throw new NotFoundError('Veículo não encontrado')

        await db`UPDATE frota SET active = false WHERE id = ${id}::uuid`
        return sendJson(res as unknown as import('http').ServerResponse, 200, {
          data: { message: 'Veículo desativado com sucesso' },
        })
      }
    }

    // ──────────────────────────────────────────────────
    // MOTORISTAS
    // ──────────────────────────────────────────────────
    if (recurso === 'motoristas') {
      if (req.method === 'GET') {
        const active = q.active !== 'false'
        const rows = await db`
          SELECT m.id, m.nome, m.unidade_id, m.active, u.nome AS unidade_nome
          FROM motoristas m
          LEFT JOIN unidades u ON u.id = m.unidade_id
          WHERE m.active = ${active}
          ORDER BY m.nome ASC
        `
        return sendJson(res as unknown as import('http').ServerResponse, 200, { data: rows })
      }
    }

    return sendJson(res as unknown as import('http').ServerResponse, 400, { error: 'Recurso não reconhecido. Use ?recurso=frota|motoristas' })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
