// Migration v2 — Audit trail (lancamentos_historico)
// Run: node schema/migration-v2.mjs

import { neon } from '@neondatabase/serverless'
import 'dotenv/config'

const db = neon(process.env.DATABASE_URL)

await db`
  CREATE TABLE IF NOT EXISTS lancamentos_historico (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lancamento_id  UUID NOT NULL REFERENCES lancamentos(id),
    usuario_id     UUID REFERENCES users(id),
    usuario_nome   VARCHAR(200),
    acao           VARCHAR(20) NOT NULL
                   CHECK (acao IN ('criar','editar','excluir','pagar','reabrir')),
    campo_alterado VARCHAR(100),
    valor_anterior TEXT,
    valor_novo     TEXT,
    ip             VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

await db`CREATE INDEX IF NOT EXISTS idx_historico_lancamento ON lancamentos_historico(lancamento_id)`
await db`CREATE INDEX IF NOT EXISTS idx_historico_usuario    ON lancamentos_historico(usuario_id)`

console.log('✅ Migration v2 aplicada — tabela lancamentos_historico criada')
