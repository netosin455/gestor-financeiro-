/**
 * Cria o usuário administrador no banco.
 * Uso: node schema/create-admin.mjs
 *
 * Requer DATABASE_URL no .env
 */

import { Pool, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

neonConfig.webSocketConstructor = ws

const EMAIL    = 'admin@araujoprev.com.br'
const SENHA    = 'Admin@2026'
const NOME     = 'Administrador'
const ROLE     = 'super_admin'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não configurada no .env')
    process.exit(1)
  }

  const pool   = new Pool({ connectionString: process.env.DATABASE_URL })
  const client = await pool.connect()
  const hash   = await bcrypt.hash(SENHA, 10)

  await client.query(
    `INSERT INTO users (name, email, password_hash, role, unidade, active)
     VALUES ($1, $2, $3, $4, NULL, true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role          = EXCLUDED.role,
       active        = true`,
    [NOME, EMAIL, hash, ROLE]
  )

  client.release()
  await pool.end()

  console.log('✅ Admin criado com sucesso!')
  console.log(`   Email: ${EMAIL}`)
  console.log(`   Senha: ${SENHA}`)
  console.log('   ⚠️  Troque a senha após o primeiro login.')
}

main()
