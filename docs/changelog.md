# Changelog — Gestor Financeiro

---

## [2026-05-19] — Entradas (receitas)

- Adicionado: coluna `tipo VARCHAR(10) DEFAULT 'saida'` na tabela `lancamentos` (migration-v3)
- Adicionado: categorias de receita no banco — 30% Alvarás, Benefícios Pagas, Sucumbências, Tutelas Antecipadas, RPV/Precatório, Honorários, Outros - Entrada, Administrativo
- Adicionado: tipo `TipoLancamento = 'entrada' | 'saida'` em `types/index.ts`
- Adicionado: `tipo` na interface `Lancamento` e `LancamentoCreate` em `types/index.ts`
- Adicionado: `'entrada'` no tipo `GrupoCategoria`
- Adicionado: filtro `tipo` no `GET /api/lancamentos`
- Adicionado: validação e inserção de `tipo` no `POST /api/lancamentos`
- Adicionado: toggle 💸 Saída / 💰 Entrada no `LancamentoModal`
- Adicionado: abas Saídas / Entradas na página de lançamentos
- Adicionado: cards de resumo — Total Entradas, Total Saídas, Saldo do Mês
- Adicionado: categorias de receita só aparecem ao selecionar Entrada no modal

---

## [2026-05-19] — Gerenciamento de usuários

- Adicionado: `api/usuarios/index.ts` — GET lista, POST criar, PUT atualizar usuários (substitui `api/frota/index.ts` para não ultrapassar limite de 12 Vercel Functions)
- Adicionado: `web/app/usuarios/page.tsx` — página admin-only para criar/editar contas (coordenador financeiro, admin, gestor)
- Adicionado: badges coloridos por role, toggle ativo/inativo
- Adicionado: item "Usuários" na Sidebar visível apenas para `super_admin` e `admin`

---

## [2026-05-19] — CRUD completo de lançamentos + Import Excel + Export CSV

- Adicionado: `web/components/LancamentoModal.tsx` — formulário criar/editar lançamento
- Adicionado: `web/components/ImportModal.tsx` — importação de `.xlsx`/`.csv` com deduplicação
- Adicionado: `web/components/Toast.tsx` — sistema de notificações (success/error/info)
- Refatorado: `web/app/lancamentos/page.tsx` — botões Novo/Importar/Exportar, ações por linha (editar/pagar/excluir), paginação
- Adicionado: `GET /api/lancamentos?meta=1` — retorna categorias + unidades para os formulários
- Adicionado: `GET /api/lancamentos?format=csv` — exportação CSV com filtro por mês
- Adicionado: deduplicação no import — compara fingerprint descrição|data|valor antes de inserir

---

## [2026-05-19] — Audit trail (migration-v2)

- Adicionado: tabela `lancamentos_historico` — registra criar/editar/excluir/pagar/reabrir
- Adicionado: `registrarAuditoria()` em `api/_lib.ts` — inserção silenciosa (nunca quebra operação)
- Adicionado: `GET /api/lancamentos/:id?historico=1` — retorna histórico de um lançamento
- Adicionado: chamadas de auditoria após POST, PUT e DELETE em lançamentos

---

## [2026-05-19] — Páginas web faltando

- Adicionado: `web/app/lancamentos/page.tsx`
- Adicionado: `web/app/relatorios/page.tsx` — comparativo mensal por categoria
- Adicionado: `web/app/alertas/page.tsx` — vencimentos próximos e pendências

---

## [2026-05-19] — Seguros

- Adicionado: `api/seguros/index.ts` — GET lista, POST criar
- Adicionado: `api/seguros/[id].ts` — GET, PUT, DELETE (soft delete via `active = false`)

---

## [2026-05-18] — Base do sistema

- Adicionado: schema SQL completo (`schema.sql`) — tabelas users, unidades, categorias, lancamentos, frota, abastecimentos, seguros
- Adicionado: seeds — 14 categorias de despesa, 7 unidades, 19 veículos MOBI
- Adicionado: `api/_lib.ts` — helpers centralizados (db, auth, cors, erros, paginação, auditoria)
- Adicionado: `api/auth/login.ts` — JWT com bcrypt
- Adicionado: `api/lancamentos/index.ts` e `[id].ts` — CRUD completo
- Adicionado: `api/relatorios/dashboard.ts`, `mensal.ts`, `por-unidade.ts`
- Adicionado: `api/alertas/index.ts`, `api/calendario/index.ts`
- Adicionado: `web/` — Next.js 14 App Router com dashboard, login, sidebar
- Adicionado: `types/index.ts` — todos os tipos TypeScript centralizados
- Adicionado: `theme/index.ts` — design system azul marinho + dourado
