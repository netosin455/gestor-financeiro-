// Migration v3 — Entradas: adiciona coluna tipo + categorias de receita
// Run: node schema/migration-v3.mjs

import { neon } from '@neondatabase/serverless'
import 'dotenv/config'

const db = neon(process.env.DATABASE_URL)

await db`
  ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(10) NOT NULL DEFAULT 'saida'
  CHECK (tipo IN ('entrada', 'saida'))
`

await db`
  INSERT INTO categorias (nome, grupo, cor) VALUES
    ('30% ALVARÁS',          'entrada', '#27AE60'),
    ('BENEFÍCIOS PAGAS',     'entrada', '#2ECC71'),
    ('SUCUMBÊNCIAS',         'entrada', '#16A085'),
    ('TUTELAS ANTECIPADAS',  'entrada', '#1ABC9C'),
    ('RPV/PRECATÓRIO',       'entrada', '#3498DB'),
    ('HONORÁRIOS',           'entrada', '#2980B9'),
    ('OUTROS - ENTRADA',     'entrada', '#8B9BB4'),
    ('ADMINISTRATIVO',       'entrada', '#F39C12')
  ON CONFLICT (nome) DO NOTHING
`

console.log('✅ Migration v3 — coluna tipo e categorias de entrada criadas')
