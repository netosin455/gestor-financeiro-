// GET  /api/lancamentos          — listagem filtrada com paginação
// GET  /api/lancamentos?meta=1   — retorna categorias + unidades para formulários
// GET  /api/lancamentos?format=csv — exportação CSV do mês
// POST /api/lancamentos          — criar novo lançamento

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  requireFields, getUnidadeFiltro, parsePagination,
  mesDaData, mesAtual, ValidationError, registrarAuditoria,
} from '../_lib'
import type { LancamentoCreate, StatusLancamento, TipoSetor } from '../../types'

const STATUS_VALIDOS: StatusLancamento[] = ['pendente', 'pago', 'atrasado', 'cancelado']
const SETORES_VALIDOS: TipoSetor[] = ['ADMINISTRATIVO', 'CAMPO', 'FOLHA DE PAGAMENTOS', 'TRIBUTOS']

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    const db   = getDb()

    // --------------------------------------------------
    // GET — Listagem com filtros (ou CSV se format=csv)
    // --------------------------------------------------
    if (req.method === 'GET') {
      const q = req.query as Record<string, string>

      // ------ Meta: categorias + unidades para formulários ------
      if (q.meta) {
        const [categorias, unidades] = await Promise.all([
          db`SELECT id, nome, grupo, cor FROM categorias ORDER BY nome`,
          db`SELECT id, nome FROM unidades WHERE active = true ORDER BY nome`,
        ])
        return sendJson(res as unknown as import('http').ServerResponse, 200, {
          data: { categorias, unidades },
        })
      }

      const mes        = q.mes        // "YYYY-MM"
      const status     = q.status as StatusLancamento | undefined
      const setor      = q.setor  as TipoSetor | undefined
      const categoriaId = q.categoriaId
      const unidadeId  = getUnidadeFiltro(user, q.unidadeId)

      if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
        throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
      }

      // ------ CSV export ------
      if (q.format === 'csv') {
        checkPermission(user, ['super_admin', 'admin'])

        const mesCsv = mes ?? mesAtual()
        const csvRows = await db`
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
            AND l.mes_referencia  = ${mesCsv}
            AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
          ORDER BY l.data_lancamento ASC, l.valor DESC
        `

        const header = 'Data,Descrição,Categoria,Unidade,Valor,Status,Vencimento,Pagamento,Setor,Observações'
        const lines  = (csvRows as Record<string, unknown>[]).map(r => [
          escapeCsv(String(r.data_lancamento ?? '').slice(0, 10)),
          escapeCsv(r.descricao),
          escapeCsv(r.categoria),
          escapeCsv(r.unidade),
          escapeCsv(r.valor),
          escapeCsv(r.status),
          escapeCsv(String(r.data_vencimento ?? '').slice(0, 10)),
          escapeCsv(String(r.data_pagamento  ?? '').slice(0, 10)),
          escapeCsv(r.setor),
          escapeCsv(r.observacoes),
        ].join(','))

        const csv    = [header, ...lines].join('\r\n')
        const srvRes = res as unknown as import('http').ServerResponse
        srvRes.statusCode = 200
        srvRes.setHeader('Content-Type', 'text/csv; charset=utf-8')
        srvRes.setHeader('Content-Disposition', `attachment; filename="lancamentos-${mesCsv}.csv"`)
        srvRes.end('﻿' + csv)
        return
      }

      // ------ Listagem paginada ------
      if (status && !STATUS_VALIDOS.includes(status)) {
        throw new ValidationError(`Status inválido: ${status}`)
      }
      if (setor && !SETORES_VALIDOS.includes(setor)) {
        throw new ValidationError(`Setor inválido: ${setor}`)
      }

      const { limit, offset, page } = parsePagination(q)

      const mesFiltro       = mes        ?? mesAtual()
      const statusFiltro    = status     ?? null
      const setorFiltro     = setor      ?? null
      const unidadeFiltro   = unidadeId  ?? null
      const categoriaFiltro = categoriaId ?? null

      const [countRows, rows] = await Promise.all([
        db`
          SELECT COUNT(*) AS total
          FROM lancamentos l
          WHERE l.deleted_at IS NULL
            AND l.mes_referencia = ${mesFiltro}
            AND (${unidadeFiltro}::uuid IS NULL OR l.unidade_id = ${unidadeFiltro}::uuid)
            AND (${categoriaFiltro}::uuid IS NULL OR l.categoria_id = ${categoriaFiltro}::uuid)
            AND (${statusFiltro} IS NULL OR l.status = ${statusFiltro})
            AND (${setorFiltro} IS NULL OR l.setor = ${setorFiltro})
        `,
        db`
          SELECT
            l.id, l.descricao, l.categoria_id, l.unidade_id, l.valor,
            l.setor, l.data_lancamento, l.data_vencimento, l.data_pagamento,
            l.status, l.pago, l.solicitado, l.mes_referencia,
            l.criado_por, l.observacoes, l.created_at, l.updated_at,
            c.nome  AS categoria_nome,
            c.grupo AS categoria_grupo,
            c.cor   AS categoria_cor,
            u.nome  AS unidade_nome,
            u.tipo  AS unidade_tipo,
            CASE
              WHEN l.status = 'pago'                                          THEN 'pago'
              WHEN l.data_vencimento < CURRENT_DATE AND l.status = 'pendente' THEN 'atrasado'
              WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '7 days'
                   AND l.status = 'pendente'                                  THEN 'vencendo'
              ELSE 'pendente'
            END AS status_calculado
          FROM lancamentos l
          LEFT JOIN categorias c ON c.id = l.categoria_id
          LEFT JOIN unidades   u ON u.id = l.unidade_id
          WHERE l.deleted_at IS NULL
            AND l.mes_referencia = ${mesFiltro}
            AND (${unidadeFiltro}::uuid IS NULL OR l.unidade_id = ${unidadeFiltro}::uuid)
            AND (${categoriaFiltro}::uuid IS NULL OR l.categoria_id = ${categoriaFiltro}::uuid)
            AND (${statusFiltro} IS NULL OR l.status = ${statusFiltro})
            AND (${setorFiltro} IS NULL OR l.setor = ${setorFiltro})
          ORDER BY l.data_lancamento DESC, l.created_at DESC
          LIMIT  ${limit}
          OFFSET ${offset}
        `,
      ])

      const total = Number(countRows[0]?.total ?? 0)

      return sendJson(res as unknown as import('http').ServerResponse, 200, {
        data:       rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      })
    }

    // --------------------------------------------------
    // POST — Criar lançamento
    // --------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as LancamentoCreate

      requireFields(body as unknown as Record<string, unknown>, [
        'descricao', 'categoria_id', 'valor', 'data_lancamento',
      ])

      const {
        descricao, categoria_id, unidade_id, valor, setor,
        data_lancamento, data_vencimento, data_pagamento,
        status = 'pendente', pago = false, solicitado = false, observacoes,
      } = body

      // Validações de negócio
      if (typeof valor !== 'number' || valor === 0) {
        throw new ValidationError('Valor não pode ser zero')
      }
      if (status && !STATUS_VALIDOS.includes(status)) {
        throw new ValidationError(`Status inválido: ${status}`)
      }
      if (setor && !SETORES_VALIDOS.includes(setor)) {
        throw new ValidationError(`Setor inválido: ${setor}`)
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data_lancamento)) {
        throw new ValidationError('data_lancamento deve estar no formato YYYY-MM-DD')
      }

      // Verifica se a categoria existe
      const cats = await db`SELECT id FROM categorias WHERE id = ${categoria_id}::uuid LIMIT 1`
      if (cats.length === 0) {
        throw new ValidationError('categoria_id não encontrada')
      }

      // Verifica se a unidade existe (quando informada)
      if (unidade_id) {
        const unis = await db`SELECT id FROM unidades WHERE id = ${unidade_id}::uuid AND active = true LIMIT 1`
        if (unis.length === 0) {
          throw new ValidationError('unidade_id não encontrada ou inativa')
        }
      }

      // Gestor só pode lançar para a própria unidade
      if (user.role === 'gestor' && unidade_id && unidade_id !== user.unidade) {
        throw new ValidationError('Gestor não pode lançar despesas de outra unidade')
      }

      const mes_referencia = mesDaData(data_lancamento)

      const [novo] = await db`
        INSERT INTO lancamentos (
          descricao, categoria_id, unidade_id, valor, setor,
          data_lancamento, data_vencimento, data_pagamento,
          status, pago, solicitado, mes_referencia, criado_por, observacoes
        ) VALUES (
          ${descricao},
          ${categoria_id}::uuid,
          ${unidade_id ?? null}::uuid,
          ${valor},
          ${setor ?? null},
          ${data_lancamento}::date,
          ${data_vencimento ?? null}::date,
          ${data_pagamento  ?? null}::date,
          ${status},
          ${pago},
          ${solicitado},
          ${mes_referencia},
          ${user.id}::uuid,
          ${observacoes ?? null}
        )
        RETURNING *
      `

      await registrarAuditoria({
        lancamentoId: novo.id as string,
        user,
        acao:         'criar',
        valorNovo:    `${descricao} — R$ ${valor}`,
      })

      return sendJson(res as unknown as import('http').ServerResponse, 201, { data: novo })
    }

    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
