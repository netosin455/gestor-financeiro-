// GET  /api/usuarios        — lista usuários (admin+)
// POST /api/usuarios        — cria usuário (admin+)
// PUT  /api/usuarios?id=xxx — atualiza usuário (admin+)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  parseBody, requireFields, NotFoundError, ValidationError,
} from '../_lib'
import type { Role } from '../../types'

const ROLES_VALIDAS: Role[] = ['super_admin', 'admin', 'financeiro', 'gestor']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    checkPermission(user, ['super_admin', 'admin'])

    const db = getDb()

    // --------------------------------------------------
    // GET — Lista usuários
    // --------------------------------------------------
    if (req.method === 'GET') {
      const rows = await db`
        SELECT u.id, u.name, u.email, u.role, u.unidade, u.active, u.created_at,
               un.nome AS unidade_nome
        FROM users u
        LEFT JOIN unidades un ON un.nome = u.unidade OR un.id::text = u.unidade
        ORDER BY u.created_at ASC
      `
      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: rows })
    }

    // --------------------------------------------------
    // POST — Criar usuário
    // --------------------------------------------------
    if (req.method === 'POST') {
      const body = await parseBody<Record<string, unknown>>(req as unknown as import('http').IncomingMessage)

      requireFields(body, ['name', 'email', 'password', 'role'])

      const { name, email, password, role, unidade } = body as {
        name: string; email: string; password: string; role: Role; unidade?: string
      }

      if (!ROLES_VALIDAS.includes(role)) {
        throw new ValidationError(`Role inválida: ${role}`)
      }
      if (typeof password !== 'string' || password.length < 6) {
        throw new ValidationError('Senha deve ter no mínimo 6 caracteres')
      }
      if (typeof email !== 'string' || !email.includes('@')) {
        throw new ValidationError('Email inválido')
      }
      // Não-super_admin não pode criar super_admin
      if (role === 'super_admin' && user.role !== 'super_admin') {
        throw new ValidationError('Apenas super_admin pode criar outro super_admin')
      }

      const existing = await db`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()} LIMIT 1`
      if (existing.length > 0) {
        throw new ValidationError('Email já cadastrado')
      }

      const hash = await bcrypt.hash(password, 10)

      const [novo] = await db`
        INSERT INTO users (name, email, password_hash, role, unidade)
        VALUES (
          ${String(name).trim()},
          ${email.toLowerCase().trim()},
          ${hash},
          ${role},
          ${unidade ?? null}
        )
        RETURNING id, name, email, role, unidade, active, created_at
      `

      return sendJson(res as unknown as import('http').ServerResponse, 201, { data: novo })
    }

    // --------------------------------------------------
    // PUT — Atualizar usuário
    // --------------------------------------------------
    if (req.method === 'PUT') {
      const { id } = req.query as { id: string }
      if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
        throw new ValidationError('id inválido')
      }

      const body = await parseBody<Record<string, unknown>>(req as unknown as import('http').IncomingMessage)
      const { name, role, unidade, active, password } = body as {
        name?: string; role?: Role; unidade?: string; active?: boolean; password?: string
      }

      if (role && !ROLES_VALIDAS.includes(role)) {
        throw new ValidationError(`Role inválida: ${role}`)
      }
      if (role === 'super_admin' && user.role !== 'super_admin') {
        throw new ValidationError('Apenas super_admin pode promover a super_admin')
      }

      const rows = await db`SELECT id, role FROM users WHERE id = ${id}::uuid LIMIT 1`
      if (rows.length === 0) throw new NotFoundError('Usuário não encontrado')

      let hashUpdate = null
      if (password) {
        if (password.length < 6) throw new ValidationError('Senha deve ter no mínimo 6 caracteres')
        hashUpdate = await bcrypt.hash(password, 10)
      }

      const [atualizado] = await db`
        UPDATE users SET
          name          = COALESCE(${name ?? null}, name),
          role          = COALESCE(${role ?? null}, role),
          unidade       = COALESCE(${unidade ?? null}, unidade),
          active        = COALESCE(${active ?? null}, active),
          password_hash = COALESCE(${hashUpdate}, password_hash)
        WHERE id = ${id}::uuid
        RETURNING id, name, email, role, unidade, active, created_at
      `

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: atualizado })
    }

    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
