// GET /api/relatorios/mensal?mes=YYYY-MM
// Retorna total por categoria no mês com comparativo ao mês anterior

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, handleError, sendJson,
  getUnidadeFiltro, mesAtual, mesAnterior, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    const db   = getDb()

    const q         = req.query as Record<string, string>
    const mes       = q.mes ?? mesAtual()
    const unidadeId = getUnidadeFiltro(user, q.unidadeId)

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const mesAnt = mesAnterior(mes)

    const [mesAtualRows, mesAntRows] = await Promise.all([
      db`
        SELECT
          c.id,
          c.nome,
          c.grupo,
          c.cor,
          COALESCE(SUM(l.valor), 0) AS valor,
          COUNT(l.id)               AS qtd
        FROM categorias c
        LEFT JOIN lancamentos l
          ON l.categoria_id = c.id
          AND l.mes_referencia = ${mes}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        GROUP BY c.id, c.nome, c.grupo, c.cor
        ORDER BY valor DESC
      `,
      db`
        SELECT
          c.id,
          COALESCE(SUM(l.valor), 0) AS valor
        FROM categorias c
        LEFT JOIN lancamentos l
          ON l.categoria_id = c.id
          AND l.mes_referencia = ${mesAnt}
          AND l.deleted_at IS NULL
          AND l.status != 'cancelado'
          AND (${unidadeId ?? null}::uuid IS NULL OR l.unidade_id = ${unidadeId ?? null}::uuid)
        GROUP BY c.id
      `,
    ])

    const antMap = new Map(
      (mesAntRows as { id: string; valor: string }[]).map(r => [r.id, Number(r.valor)])
    )

    const categorias = (mesAtualRows as {
      id: string; nome: string; grupo: string; cor: string; valor: string; qtd: string
    }[]).map(r => {
      const valorAtual = Number(r.valor)
      const valorAnt   = antMap.get(r.id) ?? 0
      const variacao   = valorAnt > 0
        ? ((valorAtual - valorAnt) / valorAnt) * 100
        : null
      return {
        id:        r.id,
        nome:      r.nome,
        grupo:     r.grupo,
        cor:       r.cor,
        valor:     valorAtual,
        qtd:       Number(r.qtd),
        valorMesAnterior: valorAnt,
        variacaoPercent:  variacao !== null ? Math.round(variacao * 10) / 10 : null,
      }
    })

    const totalMes = categorias.reduce((acc, c) => acc + c.valor, 0)
    const totalAnt = [...antMap.values()].reduce((acc, v) => acc + v, 0)

    return sendJson(res as unknown as import('http').ServerResponse, 200, {
      data: {
        mes,
        mesAnterior: mesAnt,
        totalMes,
        totalMesAnterior: totalAnt,
        variacaoPercent:  totalAnt > 0
          ? Math.round(((totalMes - totalAnt) / totalAnt) * 1000) / 10
          : null,
        categorias,
      },
    })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
