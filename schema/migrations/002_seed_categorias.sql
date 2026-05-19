-- Migração 002 — Seed: Categorias de despesa
-- 14 categorias mapeadas diretamente da planilha Caixa 2026.xlsx

INSERT INTO categorias (nome, grupo, cor) VALUES
  ('FOLHA DE PAGAMENTOS', 'folha',         '#C9A84C'),
  ('TRIBUTOS',            'tributos',      '#E67E22'),
  ('EXTRA',               'administrativo','#8B9BB4'),
  ('ALUGUEL',             'operacional',   '#2980B9'),
  ('COMBUSTÍVEL',         'campo',         '#27AE60'),
  ('FINANCIAMENTO',       'operacional',   '#9B59B6'),
  ('ENERGIA',             'operacional',   '#F39C12'),
  ('PLANO CELULAR',       'administrativo','#1ABC9C'),
  ('ÁGUA',                'operacional',   '#3498DB'),
  ('MANUTENÇÃO',          'operacional',   '#E74C3C'),
  ('SEGURO',              'operacional',   '#2ECC71'),
  ('FAXINA',              'administrativo','#95A5A6'),
  ('INTERNET',            'administrativo','#16A085'),
  ('MATERIAL DE LIMPEZA', 'administrativo','#BDC3C7')
ON CONFLICT (nome) DO NOTHING;
