# Changelog — Gestor Financeiro

---

## [2026-05-21] — Melhorias de UX: Entrada Rápida, Ações em Lote, Barra de Progresso

- Adicionado: `web/components/QuickEntry.tsx` — botão FAB flutuante em todas as páginas para lançamento rápido com 4 campos (tipo, descrição, categoria, valor/data)
- Adicionado: `web/app/ClientLayout.tsx` — wrapper client-side que injeta o QuickEntry globalmente via layout raiz
- Adicionado: Atalhos de teclado — `N` abre lançamento rápido, `?` exibe painel de atalhos, `Esc` fecha modais
- Adicionado: `web/components/EmptyState.tsx` — componente reutilizável de estado vazio com ícone, mensagem e botão de ação
- Adicionado: Checkboxes de seleção múltipla na tabela de lançamentos com barra de ações em lote (marcar como pago / cancelar)
- Adicionado: Endpoint `PATCH /api/lancamentos` para operações em lote com validação de escopo por unidade (gestor só altera própria unidade)
- Adicionado: Barra de progresso de pagamentos na aba de saídas (X/Y pagas com cor dinâmica: verde ≥80%, laranja 50-79%, vermelho <50%)
- Refatorado: `web/app/lancamentos/page.tsx` — 2 useEffects de totais e progresso fundidos em 1 (3 chamadas paralelas em vez de 2+2)
- Adicionado: `reports/bugs_found.md` e `reports/security_report.md` — documentação de bugs encontrados e análise de segurança
- Adicionado: `tests/bulk_actions.test.ts` — testes unitários de validação bulk, formulário QuickEntry e barra de progresso

---

## [2026-05-20] — IA Financeira (Fase 3)

- Adicionado: `api/ia/index.ts` — endpoint POST que chama Claude API (`claude-sonnet-4-6`) para análise automática e chat financeiro
- Adicionado: `web/components/ChatIA.tsx` — widget de chat flutuante disponível no dashboard e relatórios
- Atualizado: `web/app/dashboard/page.tsx` — card "Insight do Mês" com análise automática gerada pela IA ao abrir a página
- Atualizado: `web/app/relatorios/page.tsx` — botão "Análise IA" gera parecer detalhado do mês + widget de chat
- Adicionado: `@anthropic-ai/sdk` no `package.json` raiz
- Refatorado: `api/relatorios/dashboard.ts` + `api/relatorios/mensal.ts` + `api/relatorios/por-unidade.ts` → fundidos em `api/relatorios/index.ts` com `?tipo=dashboard|mensal|por-unidade` (libera 2 slots Vercel)
- Atualizado: páginas dashboard, alertas e relatórios para usar o novo endpoint `/api/relatorios?tipo=...`
- **Configuração necessária**: adicionar `ANTHROPIC_API_KEY` nas variáveis de ambiente do projeto Vercel

---

## [2026-05-19] — Frota, Seguros e sincronização Google Sheets

- Adicionado: `api/operacional/index.ts` — CRUD de frota e listagem de motoristas via `?recurso=frota|motoristas` (ocupa 1 slot Vercel no lugar de 3)
- Adicionado: `web/app/frota/page.tsx` — lista de veículos com edição, ativar/desativar e associação de motorista
- Adicionado: `web/app/seguros/page.tsx` — lista de seguros com resumo mensal, vencimento colorido e CRUD completo
- Adicionado: itens Frota e Seguros na Sidebar (visível para financeiro, admin, super_admin)
- Adicionado: `docs/sheets-sync.md` — guia completo do Google Apps Script para sincronização bidirecional com o Google Sheets
- Refatorado: `api/alertas/index.ts` — incorpora a lógica do calendário via `?modo=calendario` (elimina função separada)
- Removido: `api/calendario/index.ts` — funcionalidade migrada para `api/alertas?modo=calendario`
- Atualizado: `web/app/calendario/page.tsx` — aponta para o novo endpoint `/api/alertas?modo=calendario`

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
