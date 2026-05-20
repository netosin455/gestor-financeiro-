// POST /api/ia
// Corpo: { tipo: 'analise' | 'chat', mes: string, dados?: KpiDashboard, pergunta?: string }
// Retorna: { resposta: string }

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Groq from 'groq-sdk'
import {
  cors, requireAuth, handleError, sendJson,
  parseBody, ValidationError,
} from '../_lib'
import type { KpiDashboard } from '../../types'

function formatMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${nomes[Number(m) - 1]} de ${ano}`
}

function resumoKpi(dados: KpiDashboard, mes: string): string {
  const f = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const topCats = dados.porCategoria
    .slice(0, 5)
    .map(c => `  - ${c.nome}: ${f(c.valor)} (${c.percent.toFixed(1)}%)`)
    .join('\n')

  const topUnidades = dados.porUnidade
    .slice(0, 5)
    .map(u => `  - ${u.nome}: ${f(u.valor)}`)
    .join('\n')

  const alertas = dados.alertasVencimento.length > 0
    ? dados.alertasVencimento.map(a =>
        `  - ${a.descricao}: ${f(a.valor)} (vence em ${a.dias_restantes} dia${a.dias_restantes !== 1 ? 's' : ''})`
      ).join('\n')
    : '  Nenhum vencimento nos próximos 7 dias.'

  const variSinal = dados.variacaoPercent > 0 ? '+' : ''

  return `
## Dados Financeiros — ${formatMes(mes)}

**Resumo Geral**
- Total do mês: ${f(dados.totalMes)}
- Mês anterior: ${f(dados.totalMesAnterior)}
- Variação: ${variSinal}${dados.variacaoPercent.toFixed(1)}%
- Total pago: ${dados.percentPago.toFixed(1)}% do mês
- Total pendente: ${f(dados.totalPendente)}
- Lançamentos: ${dados.totalLancamentos}

**Top 5 Categorias**
${topCats || '  Sem dados'}

**Por Unidade**
${topUnidades || '  Sem dados'}

**Alertas de Vencimento (próximos 7 dias)**
${alertas}
`.trim()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res as unknown as import('http').ServerResponse)

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return sendJson(res as unknown as import('http').ServerResponse, 405, { error: 'Método não permitido' })
  }

  try {
    requireAuth(req as unknown as import('http').IncomingMessage)

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      return sendJson(res as unknown as import('http').ServerResponse, 503, {
        error: 'IA não configurada.',
        todas_env_keys: Object.keys(process.env),
      })
    }

    const body = await parseBody<{
      tipo: 'analise' | 'chat'
      mes: string
      dados?: KpiDashboard
      pergunta?: string
    }>(req as unknown as import('http').IncomingMessage)

    const { tipo, mes, dados, pergunta } = body

    if (!tipo || !['analise', 'chat'].includes(tipo)) {
      throw new ValidationError('tipo deve ser "analise" ou "chat"')
    }
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      throw new ValidationError('mes deve estar no formato YYYY-MM')
    }

    const client = new Groq({ apiKey })

    let systemPrompt: string
    let userMessage: string

    if (tipo === 'analise') {
      if (!dados) throw new ValidationError('dados (KpiDashboard) são obrigatórios para tipo=analise')

      systemPrompt = `Você é um analista financeiro especializado em escritórios de advocacia e previdência social.
Analise os dados financeiros do Gestor Financeiro Araújo Prev e forneça um insight conciso e útil.
Responda em português brasileiro, em no máximo 3 frases diretas ao ponto.
Foque no que mais importa: variações significativas, riscos de vencimento, eficiência de gastos.
Evite formalidades excessivas — seja objetivo como um bom CFO seria.`

      userMessage = resumoKpi(dados, mes)

    } else {
      if (!pergunta || !pergunta.trim()) throw new ValidationError('pergunta é obrigatória para tipo=chat')

      systemPrompt = `Você é um assistente financeiro do Gestor Financeiro Araújo Prev, um sistema de gestão de despesas de escritório de advocacia previdenciária.
Responda apenas perguntas relacionadas a finanças, gestão de despesas, categorias de gastos, fluxo de caixa e relatórios do sistema.
Seja direto, prático e fale em português brasileiro.
${dados ? `\n\nContexto atual:\n${resumoKpi(dados, mes)}` : ''}`

      userMessage = pergunta.trim()
    }

    const completion = await client.chat.completions.create({
      model:      'llama-3.3-70b-versatile',
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    })

    const resposta = completion.choices[0]?.message?.content ?? 'Não foi possível gerar uma resposta.'

    return sendJson(res as unknown as import('http').ServerResponse, 200, { data: { resposta } })
  } catch (err) {
    return handleError(err, res as unknown as import('http').ServerResponse)
  }
}
