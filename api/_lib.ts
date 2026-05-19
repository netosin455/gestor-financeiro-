// ============================================================
// GESTOR FINANCEIRO — Helpers centralizados da API
// Todas as Vercel Serverless Functions importam daqui
// ============================================================

import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import jwt from 'jsonwebtoken'
import type { IncomingMessage, ServerResponse } from 'http'
import type { Role, UserJWT } from '../types'

// ------- Banco de dados -------

let _db: NeonQueryFunction<false, false> | null = null

export function getDb(): NeonQueryFunction<false, false> {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não configurada')
    }
    _db = neon(process.env.DATABASE_URL)
  }
  return _db
}

export const db = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return (getDb() as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ------- CORS -------

export function cors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ------- Autenticação JWT -------

export function requireAuth(req: IncomingMessage): UserJWT {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token não fornecido')
  }

  const token = authHeader.slice(7)
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não configurado')
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as UserJWT
    return payload
  } catch {
    throw new UnauthorizedError('Token inválido ou expirado')
  }
}

// Verifica se o usuário tem uma das roles permitidas.
// Lança ForbiddenError se não tiver.
export function checkPermission(user: UserJWT, rolesPermitidas: Role[]): void {
  if (!rolesPermitidas.includes(user.role)) {
    throw new ForbiddenError('Permissão insuficiente para esta operação')
  }
}

// Gestor só pode ver dados da própria unidade.
// admin/financeiro/super_admin veem tudo.
export function getUnidadeFiltro(user: UserJWT, unidadeIdParam?: string): string | null {
  if (user.role === 'gestor') {
    return user.unidade ?? null
  }
  return unidadeIdParam ?? null
}

// ------- Erros tipados -------

export class UnauthorizedError extends Error {
  status = 401
  constructor(message = 'Não autorizado') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  status = 403
  constructor(message = 'Acesso negado') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends Error {
  status = 404
  constructor(message = 'Recurso não encontrado') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error {
  status = 400
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ------- Handler de erros -------

export function handleError(err: unknown, res: ServerResponse): void {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof NotFoundError ||
    err instanceof ValidationError
  ) {
    res.statusCode = err.status
    res.end(JSON.stringify({ error: err.message }))
    return
  }

  // Erro inesperado
  const msg = err instanceof Error ? err.message : String(err)
  console.error('[Gestor Financeiro] Erro interno:', err)
  res.statusCode = 500
  res.end(JSON.stringify({ error: 'Erro interno: ' + msg }))
}

// ------- Utilitários de request/response -------

export async function parseBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}') as T)
      } catch {
        reject(new ValidationError('Body JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

// ------- Validações de campos -------

export function requireFields(obj: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new ValidationError(`Campo obrigatório ausente: ${field}`)
    }
  }
}

// ------- Helpers de paginação -------

export interface PaginationParams {
  page: number
  limit: number
  offset: number
}

export function parsePagination(query: Record<string, string | string[] | undefined>): PaginationParams {
  const page  = Math.max(1, parseInt(String(query.page  ?? '1'),  10))
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '50'), 10)))
  return { page, limit, offset: (page - 1) * limit }
}

// ------- Helper para mes_referencia -------

export function mesDaData(isoDate: string): string {
  return isoDate.slice(0, 7) // "2026-01-15" → "2026-01"
}

export function mesAtual(): string {
  return new Date().toISOString().slice(0, 7)
}

export function mesAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number)
  const d = new Date(ano, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ------- Audit trail -------

export async function registrarAuditoria(params: {
  lancamentoId:  string
  user:          UserJWT
  acao:          'criar' | 'editar' | 'excluir' | 'pagar' | 'reabrir'
  campoAlterado?: string
  valorAnterior?: string
  valorNovo?:     string
  ip?:            string
}): Promise<void> {
  try {
    const db = getDb()
    await db`
      INSERT INTO lancamentos_historico
        (lancamento_id, usuario_id, usuario_nome, acao, campo_alterado, valor_anterior, valor_novo, ip)
      VALUES (
        ${params.lancamentoId}::uuid,
        ${params.user.id}::uuid,
        ${params.user.email ?? null},
        ${params.acao},
        ${params.campoAlterado ?? null},
        ${params.valorAnterior ?? null},
        ${params.valorNovo     ?? null},
        ${params.ip            ?? null}
      )
    `
  } catch (err) {
    console.error('[Auditoria] Falha ao registrar histórico:', err)
  }
}
