# Bugs Encontrados — Gestor Financeiro

---

## [2026-05-21] — Feature: Entrada Rápida, Ações em Lote, Barra de Progresso

---

### BUG-001 — Gestor pode marcar lançamentos de outras unidades via bulk

**Arquivo:** `api/lancamentos/index.ts` — handler PATCH (~linha 285)
**Impacto:** MÉDIO
**Descrição:**
O endpoint `PATCH /api/lancamentos` (bulk) atualiza todos os IDs recebidos sem verificar se pertencem à unidade do usuário. Um gestor que conhece o UUID de um lançamento de outra unidade consegue marcá-lo como pago.

**Correção aplicada:** Adicionado filtro de unidade no UPDATE quando o role for `gestor`:
```sql
AND (user.role != 'gestor' OR unidade_id = user.unidade)
```

---

### BUG-002 — Array de IDs no bulk sem limite máximo

**Arquivo:** `api/lancamentos/index.ts` — handler PATCH (~linha 280)
**Impacto:** BAIXO
**Descrição:**
O array `ids` não tem validação de tamanho máximo. Um request malicioso com milhares de IDs poderia causar lentidão no banco.

**Correção aplicada:** Validação adicionada — máximo 200 IDs por operação bulk.

---

### BUG-003 — Categorias não carregadas no QuickEntry não exibem erro ao usuário

**Arquivo:** `web/components/QuickEntry.tsx` — useEffect de carregamento (~linha 28)
**Impacto:** BAIXO
**Descrição:**
Se a chamada `/api/lancamentos?meta=1` falhar, o select de categorias fica vazio sem nenhuma mensagem de erro. O usuário tenta salvar e recebe "Selecione uma categoria" sem saber o motivo real.

**Correção aplicada:** Adicionado estado `erroMeta` que exibe mensagem de erro inline no modal.

---

### BUG-004 — Progresso de pagamentos some ao trocar para aba Entradas

**Arquivo:** `web/app/lancamentos/page.tsx` — condicional da barra de progresso (~linha 210)
**Impacto:** BAIXO (comportamento esperado, mas pode confundir)
**Descrição:**
A barra de progresso exibe `null` ao trocar para aba Entradas porque a condição é `aba === 'saida'`. Não é um bug funcional, mas o usuário pode achar que desapareceu algo.
**Status:** Comportamento aceitável — entradas não precisam de progresso de pagamento.

---

### BUG-005 — exportarCsv sem feedback de loading

**Arquivo:** `web/app/lancamentos/page.tsx` — função `exportarCsv` (~linha 165)
**Impacto:** BAIXO
**Descrição:**
O botão "Exportar CSV" não muda de estado durante o download. Para meses com muitos lançamentos, o usuário pode clicar múltiplas vezes.

**Correção sugerida:** Adicionar estado `exportando` com disabled no botão. (Não crítico — deixado para próxima iteração.)

---

## Status Geral

| Bug | Severidade | Status |
|-----|-----------|--------|
| BUG-001 | MÉDIO | ✅ Corrigido |
| BUG-002 | BAIXO | ✅ Corrigido |
| BUG-003 | BAIXO | ✅ Corrigido |
| BUG-004 | BAIXO | Aceito (comportamento intencional) |
| BUG-005 | BAIXO | Pendente (próxima iteração) |
