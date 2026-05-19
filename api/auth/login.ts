// POST /api/auth/login
// Autentica usuário com email + senha, retorna JWT de 7 dias

import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb, cors, handleError, sendJson, requireFields, ValidationError } from '../_lib'
import type { LoginRequest, LoginResponse, UserJWT } from '../../types'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const body = req.body as LoginRequest

    requireFields(body as unknown as Record<string, unknown>, ['email', 'password'])

    const { email, password } = body

    // Validação básica de formato antes de ir ao banco
    if (typeof email !== 'string' || !email.includes('@')) {
      throw new ValidationError('Email inválido')
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new ValidationError('Senha inválida')
    }

    const db = getDb()
    const rows = await db`
      SELECT id, name, email, password_hash, role, unidade, active
      FROM users
      WHERE email = ${email.toLowerCase().trim()}
      LIMIT 1
    `

    const user = rows[0]

    // Retorna a mesma mensagem para email não encontrado e senha errada
    // (evita enumeração de usuários)
    if (!user || !(await bcrypt.compare(password, user.password_hash as string))) {
      return sendJson(res as unknown as import('http').ServerResponse, 401, {
        error: 'Email ou senha incorretos',
      })
    }

    if (!user.active) {
      return sendJson(res as unknown as import('http').ServerResponse, 403, {
        error: 'Usuário desativado. Entre em contato com o administrador.',
      })
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET não configurado')
    }

    const payload: UserJWT = {
      id:      user.id as string,
      email:   user.email as string,
      role:    user.role as UserJWT['role'],
      unidade: user.unidade as string | null,
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    const response: LoginResponse = {
      token,
      user: {
        id:         user.id as string,
        name:       user.name as string,
        email:      user.email as string,
        role:       user.role as UserJWT['role'],
        unidade:    user.unidade as string | null,
        active:     user.active as boolean,
        created_at: user.created_at as string,
      },
    }

    return sendJson(res as unknown as import('http').ServerResponse, 200, response)
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
