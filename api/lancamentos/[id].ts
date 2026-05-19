// GET    /api/lancamentos/:id              — buscar por id
// GET    /api/lancamentos/:id?historico=1  — histórico de auditoria
// PUT    /api/lancamentos/:id              — atualizar
// DELETE /api/lancamentos/:id              — soft delete

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, checkPermission, handleError, sendJson,
  getUnidadeFiltro, parsePagination, NotFoundError, ForbiddenError, ValidationError,
  registrarAuditoria,
} from '../_lib'
import type { LancamentoUpdate, StatusLancamento, TipoSetor } from '../../types'

const STATUS_VALIDOS: StatusLancamento[] = ['pendente', 'pago', 'atrasado', 'cancelado']
const SETORES_VALIDOS: TipoSetor[] = ['ADMINISTRATIVO', 'CAMPO', 'FOLHA DE PAGAMENTOS', 'TRIBUTOS']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    const db   = getDb()
    const { id } = req.query as { id: string }

    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      throw new ValidationError('ID inválido')
    }

    // Busca o lançamento existente (base para GET, PUT e DELETE)
    const rows = await db`
      SELECT l.*, u.nome AS unidade_nome
      FROM lancamentos l
      LEFT JOIN unidades u ON u.id = l.unidade_id
      WHERE l.id = ${id}::uuid AND l.deleted_at IS NULL
      LIMIT 1
    `

    if (rows.length === 0) throw new NotFoundError('Lançamento não encontrado')

    const lancamento = rows[0]

    // Gestor só acessa dados da própria unidade
    const unidadePermitida = getUnidadeFiltro(user, undefined)
    if (
      user.role === 'gestor' &&
      unidadePermitida &&
      lancamento.unidade_id !== unidadePermitida
    ) {
      throw new ForbiddenError('Acesso negado a este lançamento')
    }

    // --------------------------------------------------
    // GET — lançamento ou histórico de auditoria
    // --------------------------------------------------
    if (req.method === 'GET') {
      const q = req.query as Record<string, string>

      if (q.historico) {
        checkPermission(user, ['super_admin', 'admin', 'financeiro'])
        const { limit, offset, page } = parsePagination(q)

        const hist = await db`
          SELECT id, usuario_id, usuario_nome, acao,
                 campo_alterado, valor_anterior, valor_novo, ip, created_at,
                 COUNT(*) OVER() AS total_count
          FROM lancamentos_historico
          WHERE lancamento_id = ${id}::uuid
          ORDER BY created_at DESC
          LIMIT  ${limit}
          OFFSET ${offset}
        `
        const total = hist.length > 0 ? Number(hist[0].total_count) : 0
        return sendJson(res as unknown as import('http').ServerResponse, 200, {
          data: hist, total, page, limit, totalPages: Math.ceil(total / limit),
        })
      }

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: lancamento })
    }

    // --------------------------------------------------
    // PUT — Atualizar (parcial)
    // --------------------------------------------------
    if (req.method === 'PUT') {
      const body = req.body as LancamentoUpdate

      // Validações opcionais por campo
      if (body.valor !== undefined && body.valor === 0) {
        throw new ValidationError('Valor não pode ser zero')
      }
      if (body.status && !STATUS_VALIDOS.includes(body.status)) {
        throw new ValidationError(`Status inválido: ${body.status}`)
      }
      if (body.setor && !SETORES_VALIDOS.includes(body.setor)) {
        throw new ValidationError(`Setor inválido: ${body.setor}`)
      }
      if (body.data_lancamento && !/^\d{4}-\d{2}-\d{2}$/.test(body.data_lancamento)) {
        throw new ValidationError('data_lancamento deve estar no formato YYYY-MM-DD')
      }

      const [atualizado] = await db`
        UPDATE lancamentos SET
          descricao       = COALESCE(${body.descricao       ?? null}, descricao),
          categoria_id    = COALESCE(${body.categoria_id    ?? null}::uuid, categoria_id),
          unidade_id      = COALESCE(${body.unidade_id      ?? null}::uuid, unidade_id),
          valor           = COALESCE(${body.valor           ?? null}, valor),
          setor           = COALESCE(${body.setor           ?? null}, setor),
          data_lancamento = COALESCE(${body.data_lancamento ?? null}::date, data_lancamento),
          data_vencimento = COALESCE(${body.data_vencimento ?? null}::date, data_vencimento),
          data_pagamento  = COALESCE(${body.data_pagamento  ?? null}::date, data_pagamento),
          status          = COALESCE(${body.status          ?? null}, status),
          pago            = COALESCE(${body.pago            ?? null}, pago),
          solicitado      = COALESCE(${body.solicitado      ?? null}, solicitado),
          observacoes     = COALESCE(${body.observacoes     ?? null}, observacoes),
          mes_referencia  = CASE
                              WHEN ${body.data_lancamento ?? null} IS NOT NULL
                              THEN LEFT(${body.data_lancamento ?? ''}, 7)
                              ELSE mes_referencia
                            END
        WHERE id = ${id}::uuid AND deleted_at IS NULL
        RETURNING *
      `

      await registrarAuditoria({
        lancamentoId: id,
        user,
        acao:         'editar',
        valorAnterior: `status:${lancamento.status} valor:${lancamento.valor}`,
        valorNovo:     `status:${body.status ?? lancamento.status} valor:${body.valor ?? lancamento.valor}`,
      })

      return sendJson(res as unknown as import('http').ServerResponse, 200, { data: atualizado })
    }

    // --------------------------------------------------
    // DELETE — Soft delete (só admin/financeiro/super_admin)
    // --------------------------------------------------
    if (req.method === 'DELETE') {
      if (!['super_admin', 'admin', 'financeiro'].includes(user.role)) {
        throw new ForbiddenError('Apenas admin/financeiro podem excluir lançamentos')
      }

      await db`
        UPDATE lancamentos
        SET deleted_at = NOW(), status = 'cancelado'
        WHERE id = ${id}::uuid AND deleted_at IS NULL
      `

      await registrarAuditoria({
        lancamentoId: id,
        user,
        acao:         'excluir',
        valorAnterior: `${lancamento.descricao} — R$ ${lancamento.valor}`,
      })

      return sendJson(res as unknown as import('http').ServerResponse, 200, {
        data: { message: 'Lançamento removido com sucesso' },
      })
    }

    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
