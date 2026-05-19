/**
 * import-excel.mjs — Importa dados do arquivo "Caixa 2026.xlsx" para o banco Neon.
 *
 * Execução: node schema/import-excel.mjs
 *
 * O script é idempotente: pula meses que já foram importados.
 * Cria frota e motoristas automaticamente se não existirem.
 */

import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const XLSX   = require('xlsx')
const { neon } = require('@neondatabase/serverless')

// ── Carrega .env ────────────────────────────────────────────────
const __dirname  = dirname(fileURLToPath(import.meta.url))
const projectDir = join(__dirname, '..')
const envContent = readFileSync(join(projectDir, '.env'), 'utf-8')
for (const line of envContent.split('\n')) {
  const eqIdx = line.indexOf('=')
  if (eqIdx < 1 || line.startsWith('#')) continue
  const key = line.slice(0, eqIdx).trim()
  const val = line.slice(eqIdx + 1).trim()
  process.env[key] = val
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env')
  process.exit(1)
}

const db = neon(process.env.DATABASE_URL)

// ── Mapeamento: nome Excel → nome no banco ───────────────────────
const CAT_MAP = {
  'AGUA':             'ÁGUA',
  'COMBUSTIVEL':      'COMBUSTÍVEL',
  'COMBUSTÍVEL':      'COMBUSTÍVEL',
  'MATERIAL DE LIMP': 'MATERIAL DE LIMPEZA',
  'EXTRA':            'EXTRA',
  'TARIFAS':          'TARIFAS',
  // Erros de preenchimento no Excel: setor no lugar da categoria
  'CAMPO':            'EXTRA',
}

function mapCategoria(raw) {
  const s = String(raw ?? '').trim()
  return CAT_MAP[s] ?? s
}

// ── Setor: só aceita os 4 valores válidos do CHECK ───────────────
const SETORES_VALIDOS = new Set(['ADMINISTRATIVO', 'CAMPO', 'FOLHA DE PAGAMENTOS', 'TRIBUTOS'])
const SETOR_FALLBACK  = { 'TERRA RICA': 'CAMPO' }

function mapSetor(raw) {
  const s = String(raw ?? '').trim().toUpperCase()
  if (SETORES_VALIDOS.has(s)) return s
  return SETOR_FALLBACK[s] ?? null
}

// ── Data serial do Excel → "YYYY-MM-DD" ──────────────────────────
function excelDateToISO(serial) {
  if (typeof serial !== 'number' || serial < 1) return null
  const date = new Date((serial - 25569) * 86400 * 1000)
  return date.toISOString().slice(0, 10)
}

// ── Nome da aba → "YYYY-MM" ───────────────────────────────────────
// "DESPESAS 01-2026" → "2026-01"
function sheetToMes(name) {
  const m = name.match(/(\d{2})-(\d{4})/)
  return m ? `${m[2]}-${m[1]}` : null
}

// ── Cache para evitar consultas repetidas ao banco ────────────────
const frotaCache     = {}  // nome → id
const motoristaCache = {}  // nome → id

async function getFrotaId(nome, placa) {
  if (frotaCache[nome]) return frotaCache[nome]
  const rows = await db`SELECT id FROM frota WHERE nome = ${nome}`
  if (rows.length > 0) {
    frotaCache[nome] = rows[0].id
    return rows[0].id
  }
  const ins = await db`INSERT INTO frota (nome, placa) VALUES (${nome}, ${placa}) RETURNING id`
  frotaCache[nome] = ins[0].id
  console.log(`    + Frota criada: ${nome} (${placa})`)
  return ins[0].id
}

async function getMotoristId(nome) {
  if (motoristaCache[nome]) return motoristaCache[nome]
  const rows = await db`SELECT id FROM motoristas WHERE nome = ${nome}`
  if (rows.length > 0) {
    motoristaCache[nome] = rows[0].id
    return rows[0].id
  }
  const ins = await db`INSERT INTO motoristas (nome) VALUES (${nome}) RETURNING id`
  motoristaCache[nome] = ins[0].id
  console.log(`    + Motorista criado: ${nome}`)
  return ins[0].id
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('📊 Gestor Financeiro — Importação do Excel\n')

  // Carrega categorias do banco
  const categorias = await db`SELECT id, nome FROM categorias`
  const catById = Object.fromEntries(categorias.map(c => [c.nome, c.id]))
  console.log(`✓ ${categorias.length} categorias carregadas do banco`)

  // Lê o Excel
  const excelPath = join(projectDir, 'Caixa 2026.xlsx')
  const wb = XLSX.readFile(excelPath)
  console.log(`✓ Excel carregado: ${wb.SheetNames.length} abas\n`)

  let totalLancamentos   = 0
  let totalAbastecimentos = 0
  let skipped = 0

  for (const sheetName of wb.SheetNames) {
    const mes = sheetToMes(sheetName)
    if (!mes) { console.warn(`Aba ignorada: ${sheetName}`); continue }

    console.log(`─── ${sheetName} (${mes}) ───────────────────`)

    // Idempotência: pula se já tem dados
    const [{ cnt }] = await db`
      SELECT COUNT(*)::int AS cnt FROM lancamentos
      WHERE mes_referencia = ${mes} AND deleted_at IS NULL
    `
    if (cnt > 0) {
      console.log(`  ⏭  Já importado (${cnt} lançamentos). Pulando.\n`)
      skipped++
      continue
    }

    const ws   = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    const headerRow = data[1] ?? []

    // ── Lançamentos (lado esquerdo, colunas 0–7) ──────────────────
    let countLanc = 0
    for (let i = 2; i < data.length; i++) {
      const row      = data[i]
      const descricao = String(row[0] ?? '').trim()
      const tipoRaw   = String(row[1] ?? '').trim()
      const setorRaw  = String(row[2] ?? '').trim()
      const valor     = row[3]
      const pagosRaw  = String(row[4] ?? '').trim().toUpperCase()
      const solRaw    = String(row[5] ?? '').trim().toUpperCase()
      const diaVenc   = row[6]
      const dataPgRaw = row[7]

      if (!descricao || typeof valor !== 'number' || valor <= 0) continue

      const catNome = mapCategoria(tipoRaw)
      const catId   = catById[catNome]
      if (!catId) {
        console.warn(`  ⚠  Categoria desconhecida: "${tipoRaw}" → "${catNome}" (linha ${i + 1})`)
        continue
      }

      const setor         = mapSetor(setorRaw)
      const isPago        = pagosRaw === 'SIM'
      const isSolicitado  = solRaw   === 'SIM'
      const dataPagamento = excelDateToISO(dataPgRaw)

      // Monta data_vencimento: dia do campo + mês da aba (valida se a data existe)
      let dataVencimento = null
      const diaNum = parseInt(String(diaVenc ?? '').trim(), 10)
      if (!isNaN(diaNum) && diaNum >= 1 && diaNum <= 31) {
        const [ano, m] = mes.split('-')
        const d = new Date(Number(ano), Number(m) - 1, diaNum)
        // Só aceita se o mês não "transbordar" (ex: fev/31 vira mar/03)
        if (d.getMonth() === Number(m) - 1) {
          dataVencimento = `${ano}-${m}-${String(diaNum).padStart(2, '0')}`
        }
      }

      const dataLancamento = dataPagamento ?? `${mes}-01`

      await db`
        INSERT INTO lancamentos
          (descricao, categoria_id, valor, setor,
           data_lancamento, data_vencimento, data_pagamento,
           status, pago, solicitado, mes_referencia)
        VALUES
          (${descricao}, ${catId}, ${valor.toFixed(2)}, ${setor},
           ${dataLancamento}, ${dataVencimento}, ${dataPagamento},
           ${isPago ? 'pago' : 'pendente'}, ${isPago}, ${isSolicitado}, ${mes})
      `
      countLanc++
    }
    console.log(`  ✓ ${countLanc} lançamentos inseridos`)
    totalLancamentos += countLanc

    // ── Abastecimentos (lado direito, col 10 = frota, 11+ = motoristas) ─
    // Mapeia quais colunas têm motoristas (header != '' e != 'TOTAL')
    const motCols = {}
    for (let col = 11; col < headerRow.length; col++) {
      const nome = String(headerRow[col] ?? '').trim()
      if (nome && nome.toUpperCase() !== 'TOTAL') motCols[col] = nome
    }

    let countAbast = 0
    for (let i = 2; i < data.length; i++) {
      const row        = data[i]
      const frotaRaw   = String(row[10] ?? '').trim()
      if (!frotaRaw || frotaRaw === '') continue

      // "MOBI 01 - RUD-4D14"
      const match = frotaRaw.match(/^(.+?)\s+-\s+(.+)$/)
      if (!match) continue
      const frotaNome  = match[1].trim()
      const frotaPlaca = match[2].trim()
      const frotaId    = await getFrotaId(frotaNome, frotaPlaca)

      for (const [colStr, motoristaNome] of Object.entries(motCols)) {
        const colIdx = Number(colStr)
        const valor  = row[colIdx]
        if (typeof valor !== 'number' || valor <= 0) continue

        const motoristaId = await getMotoristId(motoristaNome)

        // Idempotência por frota + motorista + mês
        const [{ exists }] = await db`
          SELECT EXISTS (
            SELECT 1 FROM abastecimentos
            WHERE frota_id = ${frotaId}
              AND motorista_id = ${motoristaId}
              AND mes_referencia = ${mes}
          ) AS exists
        `
        if (exists) continue

        await db`
          INSERT INTO abastecimentos (frota_id, motorista_id, valor, data_abastecimento, mes_referencia)
          VALUES (${frotaId}, ${motoristaId}, ${valor.toFixed(2)}, ${mes + '-01'}, ${mes})
        `
        countAbast++
      }
    }
    console.log(`  ✓ ${countAbast} abastecimentos inseridos\n`)
    totalAbastecimentos += countAbast
  }

  console.log('═══════════════════════════════════════')
  console.log('✅ Importação concluída!')
  console.log(`   Lançamentos:    ${totalLancamentos}`)
  console.log(`   Abastecimentos: ${totalAbastecimentos}`)
  if (skipped > 0) console.log(`   Abas puladas:   ${skipped} (já importadas)`)
  console.log('═══════════════════════════════════════')
}

main().catch(err => {
  console.error('\n❌ Erro na importação:', err.message)
  process.exit(1)
})
