// GET /api/exportar/csv?mes=YYYY-MM
// Exporta todos os lançamentos do mês em CSV

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError,
  getUnidadeFiltro, mesAtual, ValidationError,
} from '../_lib'

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatDate(value: unknown): string {
  if (!value) return ''
  const d = String(value).slice(0, 10) // "2026-01-15T..." → "2026-01-15"
  return d
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return (res as unknown as import('http').ServerResponse).end()
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    checkPermission(user, ['super_admin', 'admin'])

    const db  = getDb()
    const q   = req.query as Record<string, string>
    const mes = q.mes ?? mesAtual()
    const unidadeId = getUnidadeFiltro(user, q.unidadeId)

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const rows = await db`
      SELECT
        l.data_lancamento,
        l.descricao,
        c.nome            AS categoria,
        u.nome            AS unidade,
        l.valor,
        l.status,
        l.data_vencimento,
        l.data_pagamento,
        l.setor,
        l.observacoes
      FROM lancamentos l
      LEFT JOIN categorias c ON c.id = l.categoria_id
      LEFT JOIN unidades   u ON u.id = l.unidade_id
      WHERE l.deleted_at     IS NULL
        AND l.mes_referencia  = ${mes}
        AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
      ORDER BY l.data_lancamento ASC, l.valor DESC
    `

    const header = [
      'Data', 'Descrição', 'Categoria', 'Unidade',
      'Valor', 'Status', 'Vencimento', 'Pagamento', 'Setor', 'Observações',
    ].join(',')

    const lines = (rows as Record<string, unknown>[]).map(r => [
      escapeCsv(formatDate(r.data_lancamento)),
      escapeCsv(r.descricao),
      escapeCsv(r.categoria),
      escapeCsv(r.unidade),
      escapeCsv(r.valor),
      escapeCsv(r.status),
      escapeCsv(formatDate(r.data_vencimento)),
      escapeCsv(formatDate(r.data_pagamento)),
      escapeCsv(r.setor),
      escapeCsv(r.observacoes),
    ].join(','))

    const csv = [header, ...lines].join('\r\n')

    const srvRes = res as unknown as import('http').ServerResponse
    srvRes.statusCode = 200
    srvRes.setHeader('Content-Type', 'text/csv; charset=utf-8')
    srvRes.setHeader('Content-Disposition', `attachment; filename="lancamentos-${mes}.csv"`)
    srvRes.end('﻿' + csv) // BOM para Excel reconhecer UTF-8
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
