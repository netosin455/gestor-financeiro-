-- Migração 004 — Seed: Frota e Motoristas
-- 13 veículos MOBI com placas reais + 15 motoristas mapeados do Excel

-- Frota (veículos identificados nas abas de combustível)
INSERT INTO frota (nome, placa) VALUES
  ('MOBI 01',  'RUD-4D14'),
  ('MOBI 02',  'RVC-6D19'),
  ('MOBI 09',  'RHB-0C15'),
  ('MOBI 10',  'RHA-9D84'),
  ('MOBI 11',  'RHB-0C17'),
  ('MOBI 12',  'RHB-0C14'),
  ('MOBI 13',  'RHA-8H34'),
  ('MOBI 14',  'RHB-3I00'),
  ('MOBI 15',  'RHB-1D15'),
  ('MOBI 16',  'SEM-8J34'),
  ('MOBI 17',  'SEO-5C02'),
  ('MOBI 18',  'SEO-9I87'),
  ('MOBI 19',  'SFN-7C83')
ON CONFLICT DO NOTHING;

-- Motoristas (colunas L-Z da seção de combustível)
INSERT INTO motoristas (nome) VALUES
  ('LEANDRO TR'),
  ('ROSELI'),
  ('ALEXSANDRO'),
  ('JESSICA'),
  ('CARLA'),
  ('LEONARDO'),
  ('CLAUDEIR'),
  ('LEANDRO SP'),
  ('ADM'),
  ('MOTTA'),
  ('ALECIO'),
  ('MATHEUS'),
  ('VITOR'),
  ('MURILO'),
  ('PAULO')
ON CONFLICT (nome) DO NOTHING;
