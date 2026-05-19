-- Migração 003 — Seed: Unidades (escritórios e unidades de campo)
-- 7 unidades mapeadas da planilha Caixa 2026.xlsx

INSERT INTO unidades (nome, cidade, estado, tipo) VALUES
  ('Terra Rica',             'Terra Rica',             'PR', 'escritorio'),
  ('Primavera',              'Primavera do Leste',     'MT', 'escritorio'),
  ('Teodoro',                'Teodoro Sampaio',        'SP', 'escritorio'),
  ('Presidente Venceslau',   'Presidente Venceslau',   'SP', 'escritorio'),
  ('Ivinhema',               'Ivinhema',               'MS', 'escritorio'),
  ('Narandiba',              'Narandiba',              'SP', 'campo'),
  ('Euclides',               'Euclides da Cunha Paulista', 'SP', 'campo')
ON CONFLICT DO NOTHING;
