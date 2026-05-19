-- ============================================================
-- GESTOR FINANCEIRO — Schema Base Completo
-- Escritório de advocacia | Planejar · Gerir · Fazer Crescer
-- ============================================================

-- Extensão para UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- USUÁRIOS E AUTENTICAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'gestor'
                CHECK (role IN ('super_admin', 'admin', 'financeiro', 'gestor')),
  unidade       VARCHAR(100),       -- NULL = acesso global (admin/financeiro)
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UNIDADES (escritórios)
-- ============================================================
CREATE TABLE IF NOT EXISTS unidades (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome    VARCHAR(100) NOT NULL,
  cidade  VARCHAR(100),
  estado  VARCHAR(2),
  tipo    VARCHAR(20) NOT NULL DEFAULT 'escritorio'
          CHECK (tipo IN ('escritorio', 'campo')),
  active  BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- CATEGORIAS DE DESPESA
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome  VARCHAR(100) NOT NULL UNIQUE,
  grupo VARCHAR(50),   -- operacional | administrativo | campo | folha | tributos
  cor   VARCHAR(7)     -- hex para visualização nos gráficos
);

-- ============================================================
-- LANÇAMENTOS (tabela principal)
-- ============================================================
CREATE TABLE IF NOT EXISTS lancamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao        TEXT NOT NULL,
  categoria_id     UUID REFERENCES categorias(id),
  unidade_id       UUID REFERENCES unidades(id),
  valor            DECIMAL(12,2) NOT NULL,
  setor            VARCHAR(50)   -- ADMINISTRATIVO | CAMPO | FOLHA DE PAGAMENTOS | TRIBUTOS
                   CHECK (setor IN ('ADMINISTRATIVO', 'CAMPO', 'FOLHA DE PAGAMENTOS', 'TRIBUTOS')),
  data_lancamento  DATE NOT NULL,
  data_vencimento  DATE,
  data_pagamento   DATE,
  status           VARCHAR(20) NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  pago             BOOLEAN NOT NULL DEFAULT false,
  solicitado       BOOLEAN NOT NULL DEFAULT false,
  mes_referencia   VARCHAR(7),   -- "2026-01" para facilitar filtros
  criado_por       UUID REFERENCES users(id),
  observacoes      TEXT,
  deleted_at       TIMESTAMPTZ,  -- soft delete
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_mes ON lancamentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_unidade ON lancamentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos(status);
CREATE INDEX IF NOT EXISTS idx_lancamentos_deleted ON lancamentos(deleted_at);

-- ============================================================
-- FROTA DE VEÍCULOS
-- ============================================================
CREATE TABLE IF NOT EXISTS frota (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 VARCHAR(50) NOT NULL,    -- "MOBI 01"
  placa                VARCHAR(10),             -- "RUD-4D14"
  proprietario         VARCHAR(100),
  motorista_principal  VARCHAR(100),
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MOTORISTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS motoristas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       VARCHAR(100) NOT NULL UNIQUE,
  unidade_id UUID REFERENCES unidades(id),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ABASTECIMENTOS POR VEÍCULO/MOTORISTA
-- ============================================================
CREATE TABLE IF NOT EXISTS abastecimentos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frota_id            UUID REFERENCES frota(id),
  motorista_id        UUID REFERENCES motoristas(id),
  valor               DECIMAL(10,2) NOT NULL,
  data_abastecimento  DATE NOT NULL,
  mes_referencia      VARCHAR(7) NOT NULL,   -- "2026-01"
  unidade_id          UUID REFERENCES unidades(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_abastecimentos_mes ON abastecimentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_frota ON abastecimentos(frota_id);

-- ============================================================
-- SEGUROS DA FROTA
-- ============================================================
CREATE TABLE IF NOT EXISTS seguros (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frota_id         UUID REFERENCES frota(id),
  proprietario     VARCHAR(100),
  valor_parcela    DECIMAL(10,2),
  num_parcelas     INTEGER,
  data_vencimento  DATE,
  forma_pagamento  VARCHAR(50),
  corretora        VARCHAR(100),
  local_debito     VARCHAR(100),
  seguradora       VARCHAR(100),
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIEW: Analytics de lançamentos
-- ============================================================
CREATE OR REPLACE VIEW vw_lancamentos_analytics AS
SELECT
  l.*,
  c.nome  AS categoria_nome,
  c.grupo AS categoria_grupo,
  c.cor   AS categoria_cor,
  u.nome  AS unidade_nome,
  u.tipo  AS unidade_tipo,
  CASE
    WHEN l.status = 'pago'                                                      THEN 'pago'
    WHEN l.data_vencimento < CURRENT_DATE AND l.status = 'pendente'             THEN 'atrasado'
    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '7 days'
         AND l.status = 'pendente'                                              THEN 'vencendo'
    ELSE 'pendente'
  END AS status_calculado
FROM lancamentos l
LEFT JOIN categorias c ON c.id = l.categoria_id
LEFT JOIN unidades   u ON u.id = l.unidade_id
WHERE l.deleted_at IS NULL;

-- ============================================================
-- TRIGGER: atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lancamentos_updated_at ON lancamentos;
CREATE TRIGGER trg_lancamentos_updated_at
  BEFORE UPDATE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
