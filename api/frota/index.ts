// GET /api/frota?mes=YYYY-MM
// Retorna frota com totais de abastecimento por veículo/motorista no mês

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getDb, cors, requireAuth, handleError, sendJson,
  checkPermission, mesAtual, ValidationError,
} from '../_lib'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    const user = requireAuth(req as unknown as import('http').IncomingMessage)
    checkPermission(user, ['super_admin', 'admin', 'financeiro'])

    const db  = getDb()
    const q   = req.query as Record<string, string>
    const mes = q.mes ?? mesAtual()

    if (!/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('Parâmetro mes deve estar no formato YYYY-MM')
    }

    const [frotaRows, abastecimentoRows, motoristasRows] = await Promise.all([
      // Frota com total de abastecimento no mês
      db`
        SELECT
          f.id,
          f.nome,
          f.placa,
          f.motorista_principal,
          f.active,
          COALESCE(SUM(a.valor), 0) AS total_combustivel_mes,
          COUNT(a.id)               AS qtd_abastecimentos
        FROM frota f
        LEFT JOIN abastecimentos a
          ON a.frota_id = f.id AND a.mes_referencia = ${mes}
        WHERE f.active = true
        GROUP BY f.id, f.nome, f.placa, f.motorista_principal, f.active
        ORDER BY f.nome
      `,

      // Abastecimentos detalhados do mês
      db`
        SELECT
          a.id,
          a.frota_id,
          a.motorista_id,
          a.valor,
          a.data_abastecimento,
          f.nome  AS frota_nome,
          f.placa AS frota_placa,
          m.nome  AS motorista_nome
        FROM abastecimentos a
        JOIN frota      f ON f.id = a.frota_id
        LEFT JOIN motoristas m ON m.id = a.motorista_id
        WHERE a.mes_referencia = ${mes}
        ORDER BY a.data_abastecimento DESC
      `,

      // Total por motorista no mês
      db`
        SELECT
          m.id,
          m.nome,
          COALESCE(SUM(a.valor), 0) AS total_mes,
          COUNT(a.id)               AS qtd_abastecimentos
        FROM motoristas m
        LEFT JOIN abastecimentos a
          ON a.motorista_id = m.id AND a.mes_referencia = ${mes}
        WHERE m.active = true
        GROUP BY m.id, m.nome
        ORDER BY total_mes DESC
      `,
    ])

    return sendJson(res as unknown as import('http').ServerResponse, 200, {
      data: {
        mes,
        frota:         frotaRows,
        abastecimentos: abastecimentoRows,
        porMotorista:  motoristasRows,
        totalMes:      (frotaRows as { total_combustivel_mes: string }[])
          .reduce((acc, r) => acc + Number(r.total_combustivel_mes), 0),
      },
    })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
