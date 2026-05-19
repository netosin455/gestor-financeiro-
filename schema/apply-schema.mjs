/**
 * Script para aplicar o schema e seeds no banco Neon.
 * Uso: node schema/apply-schema.mjs
 *
 * Requer DATABASE_URL no .env
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import 'dotenv/config'

// Pool usa WebSockets e suporta múltiplos statements por query
neonConfig.webSocketConstructor = ws

const __dirname = dirname(fileURLToPath(import.meta.url))

const migrations = [
  'schema.sql',
  'migrations/002_seed_categorias.sql',
  'migrations/003_seed_unidades.sql',
  'migrations/004_seed_frota.sql',
]

async function apply() {
  const pool   = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()

  try {
    for (const file of migrations) {
      const filePath = join(__dirname, file)
      const sql      = readFileSync(filePath, 'utf-8')
      console.log(`\n▶ Aplicando: ${file}`)
      await client.query(sql)
      console.log(`✓ OK: ${file}`)
    }
    console.log('\n✅ Schema aplicado com sucesso!')
  } catch (err) {
    console.error('\n✗ ERRO:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

apply()
