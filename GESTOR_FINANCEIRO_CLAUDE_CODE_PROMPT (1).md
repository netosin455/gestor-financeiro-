# 🧠 Gestor Financeiro — Prompt Estratégico para Claude Code

> Cole este arquivo inteiro no início de qualquer sessão com o Claude Code.
> Ele contém o contexto completo do projeto, decisões de arquitetura, regras de código e roadmap.

---

## 🎯 Contexto do Projeto

Você está trabalhando no **Gestor Financeiro**, um sistema interno de gestão de caixa
desenvolvido para um **escritório de advocacia** com múltiplas unidades espalhadas pelo interior
de São Paulo e Mato Grosso do Sul.

**Identidade visual:** Logo azul marinho escuro + dourado. Slogan: *"Planejar · Gerir · Fazer Crescer"*.

### O problema que estamos resolvendo

Hoje a equipe financeira controla tudo em planilhas Excel mensais (`Caixa_2026.xlsx`) com
estrutura caótica: cada aba tem os lançamentos de pagamentos misturados com controles auxiliares
de frota, seguros e combustível — tudo na mesma aba, repetido manualmente todo mês.

São mais de 300 lançamentos só em janeiro, com categorias como:
- Folha de pagamentos
- Combustível (por motorista e por unidade)
- Aluguéis (5 unidades)
- Seguros de frota (19 veículos MOBI)
- Tributos (IPVA parcelado, escritórios Xavantes)
- Internet, energia, água por unidade
- Compras de RPV/Precatório
- Extras/administrativo

**O sistema atual não tem:** consolidação entre meses, alertas de vencimento, dashboard,
comparativo entre unidades, análise histórica, ou qualquer automação.

---

## 👥 Usuários do Sistema

- **~10 pessoas** no total usarão o app
- Perfis: coordenador financeiro + gestores de cada unidade
- O coordenador financeiro prefere trabalhar em Google Sheets/Excel — o sistema deve se
  sincronizar automaticamente com a planilha dele
- Gestores de unidade lançam despesas pelo celular (mobile-first)

### Roles e permissões (RBAC)

| Role | Acesso |
|---|---|
| `super_admin` | Tudo, configurações do sistema |
| `admin` | Tudo exceto configurações de sistema |
| `financeiro` | Dashboard, relatórios, todos os lançamentos, alertas, IA |
| `gestor` | Lançar despesas da sua unidade, ver relatórios da própria unidade |

---

## 🏗️ Stack Tecnológica (não alterar sem justificativa)

| Camada | Tecnologia | Motivo |
|---|---|---|
| Mobile | React Native + Expo Router | Cross-platform iOS/Android, mesma stack do SuperRH |
| Web (painel) | Next.js 14 (App Router) | SSR para dashboards pesados, deploy Vercel |
| Linguagem | TypeScript strict (sem `any`) | Tipagem obrigatória em todo o projeto |
| API | Vercel Serverless Functions | Sem servidor pra gerenciar, escalável |
| Banco | Neon PostgreSQL (serverless) | Mesma infra do SuperRH, já conhecida |
| Auth | JWT (7 dias) + bcrypt | Simples e seguro |
| IA | Claude API (claude-sonnet-4-20250514) | Análise financeira com contexto real |
| Sheets | Google Sheets API v4 | Sync automático bidirecional |
| Notificações | Expo Push + Resend (email) | Alertas de vencimento e resumo mensal |
| Deploy mobile | Expo / EAS | |
| Deploy API/Web | Vercel | |

---

## 🎨 Design System — Azul Marinho + Dourado

Inspirado na logo do produto: azul marinho escuro como cor principal, dourado como destaque.

```ts
// theme/index.ts
export const colors = {
  // Backgrounds
  bg:        '#0A0E1A',  // Azul muito escuro — background principal
  surface:   '#111827',  // Superfície de cards
  border:    '#1E2A3A',  // Bordas sutis

  // Cores principais
  navy:      '#1E3A5F',  // Azul marinho — elementos secundários
  navyLight: '#2E5080',  // Azul médio — hover states
  gold:      '#C9A84C',  // Dourado principal — CTAs, ícones ativos
  goldLight: '#E2C97E',  // Dourado claro — textos em destaque
  goldDim:   '#7A6230',  // Dourado escuro — estados desabilitados

  // Texto
  text:      '#F2F0EA',  // Off-white quente — texto principal
  textMuted: '#8B9BB4',  // Texto secundário / labels

  // Semânticas
  danger:    '#C0392B',  // Vermelho — erros, alertas críticos
  warning:   '#E67E22',  // Laranja — avisos, vencendo em breve
  success:   '#27AE60',  // Verde — confirmações, pago
  info:      '#2980B9',  // Azul — informações neutras
}
```

**Regras de design inegociáveis:**
- Fundo sempre `#0A0E1A` — nunca branco ou cinza claro
- CTAs e elementos ativos usam `gold` como cor de destaque
- Cards usam `surface` com borda `border` e `borderRadius: 12`
- Status de pagamento: verde = PAGO, laranja = PENDENTE, vermelho = ATRASADO
- Tipografia: títulos em `goldLight`, corpo em `text`, labels em `textMuted`
- Gráficos: barras em `gold`, linhas de tendência em `navyLight`
- Separadores usam dourado sutil

---

## 📁 Estrutura de Pastas (respeitar rigorosamente)

```
gestor-financeiro/
├── app/                              ← React Native (mobile)
│   ├── _layout.tsx                   # Root layout + AuthProvider
│   ├── login.tsx
│   └── (tabs)/
│       ├── _layout.tsx               # Tab bar
│       ├── index.tsx                 # Dashboard principal
│       ├── lancamentos.tsx           # Lista e lançamento de despesas
│       ├── alertas.tsx               # Vencimentos e pendências
│       ├── relatorios.tsx            # Relatórios e gráficos
│       └── ia.tsx                    # Assistente IA financeiro
│
├── web/                              ← Next.js (painel web)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Redirect para dashboard
│   │   ├── dashboard/page.tsx        # Dashboard principal
│   │   ├── lancamentos/page.tsx
│   │   ├── relatorios/page.tsx
│   │   ├── alertas/page.tsx
│   │   ├── frota/page.tsx            # Controle de veículos
│   │   ├── seguros/page.tsx
│   │   └── ia/page.tsx
│   └── components/
│
├── api/                              ← Vercel Serverless Functions
│   ├── _lib.ts                       # db, auth helpers, cors
│   ├── auth/
│   │   └── login.ts
│   ├── lancamentos/
│   │   ├── index.ts                  # GET list, POST create
│   │   └── [id].ts                   # GET, PUT, DELETE by id
│   ├── relatorios/
│   │   ├── mensal.ts                 # Consolidado mensal
│   │   ├── por-categoria.ts
│   │   ├── por-unidade.ts
│   │   └── comparativo.ts           # Mês a mês
│   ├── alertas/
│   │   └── index.ts                  # Vencimentos próximos
│   ├── frota/
│   │   └── index.ts                  # Veículos e combustível
│   ├── seguros/
│   │   └── index.ts                  # Controle de seguros
│   ├── sheets/
│   │   └── sync.ts                   # Sincronização Google Sheets
│   └── ia/
│       └── analise.ts                # Análise financeira com Claude
│
├── components/                       ← Componentes compartilhados (mobile)
│   ├── GoldDivider.tsx
│   ├── StatusPill.tsx               # PAGO / PENDENTE / ATRASADO
│   ├── LancamentoCard.tsx
│   ├── MetricCard.tsx               # Card de KPI no dashboard
│   ├── GraficoBarras.tsx
│   └── AlertaCard.tsx
│
├── hooks/
│   ├── useLancamentos.ts
│   ├── useRelatorios.ts
│   ├── useAlertas.ts
│   ├── useFreota.ts
│   └── useIA.ts
│
├── services/
│   └── api.ts                        # apiFetch centralizado
│
├── contexts/
│   └── AuthContext.tsx
│
├── schema/
│   ├── schema.sql                    # Schema base completo
│   └── migrations/
│       ├── 001_base.sql
│       ├── 002_frota.sql
│       └── 003_seguros.sql
│
├── types/
│   └── index.ts                      # Todos os tipos TypeScript
│
├── theme/
│   └── index.ts                      # Design system completo
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── changelog.md
│
├── .env                              # Nunca commitar
├── .env.example
├── README.md
└── RULES.md
```

---

## 🗄️ Schema do Banco de Dados

```sql
-- Usuários e autenticação
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'gestor',  -- super_admin | admin | financeiro | gestor
  unidade VARCHAR(100),               -- unidade do gestor (null = acesso global)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unidades (escritórios)
CREATE TABLE unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,         -- Terra Rica, Primavera, Teodoro, etc.
  cidade VARCHAR(100),
  estado VARCHAR(2),
  active BOOLEAN DEFAULT true
);

-- Categorias de despesa
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,         -- FOLHA DE PAGAMENTOS, COMBUSTIVEL, ALUGUEL...
  grupo VARCHAR(50),                  -- operacional | administrativo | campo
  cor VARCHAR(7)                      -- hex para visualização
);

-- Lançamentos (tabela principal)
CREATE TABLE lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES categorias(id),
  unidade_id UUID REFERENCES unidades(id),
  valor DECIMAL(12,2) NOT NULL,
  data_lancamento DATE NOT NULL,
  data_vencimento DATE,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente',  -- pendente | pago | atrasado | cancelado
  solicitado BOOLEAN DEFAULT false,
  tipo VARCHAR(30),                   -- CAMPO | ADMINISTRATIVO | TRIBUTOS | etc.
  criado_por UUID REFERENCES users(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frota de veículos
CREATE TABLE frota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(50) NOT NULL,          -- MOBI 01, MOBI 02, etc.
  placa VARCHAR(10),
  proprietario VARCHAR(100),
  motorista_responsavel VARCHAR(100),
  active BOOLEAN DEFAULT true
);

-- Abastecimentos por veículo
CREATE TABLE abastecimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frota_id UUID REFERENCES frota(id),
  motorista VARCHAR(100),
  valor DECIMAL(10,2) NOT NULL,
  data_abastecimento DATE NOT NULL,
  unidade_id UUID REFERENCES unidades(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seguros da frota
CREATE TABLE seguros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frota_id UUID REFERENCES frota(id),
  proprietario VARCHAR(100),
  valor_parcela DECIMAL(10,2),
  num_parcelas INTEGER,
  data_vencimento DATE,
  forma_pagamento VARCHAR(50),
  corretora VARCHAR(100),
  local_debito VARCHAR(100),
  seguradora VARCHAR(100),
  active BOOLEAN DEFAULT true
);

-- View para analytics
CREATE VIEW vw_lancamentos_analytics AS
SELECT
  l.*,
  c.nome AS categoria_nome,
  c.grupo AS categoria_grupo,
  u.nome AS unidade_nome,
  CASE
    WHEN l.status = 'pago' THEN 'pago'
    WHEN l.data_vencimento < CURRENT_DATE AND l.status = 'pendente' THEN 'atrasado'
    WHEN l.data_vencimento <= CURRENT_DATE + INTERVAL '7 days' THEN 'vencendo'
    ELSE 'pendente'
  END AS status_calculado
FROM lancamentos l
LEFT JOIN categorias c ON c.id = l.categoria_id
LEFT JOIN unidades u ON u.id = l.unidade_id;
```

---

## 📊 Dados Reais do Projeto (base atual)

**Unidades mapeadas da planilha atual:**
- Terra Rica (sede)
- Primavera
- Teodoro
- Presidente Venceslau
- Ivinhema
- Narandiba (campo)
- Euclides (campo)

**Frota atual (19 veículos MOBI):**
- MOBI 01 a MOBI 19 com placas mapeadas
- Motoristas: Leandro TR, Roseli, Alexsandro, Jessica, Carla, Leonardo, Claudeir, Leandro SP, ADM, Motta, Alecio, Matheus, Vitor, Murilo, Paulo

**Categorias de despesa mapeadas:**
```
FOLHA DE PAGAMENTOS, COMBUSTIVEL, ALUGUEL, SEGURO,
ENERGIA, AGUA, INTERNET, PLANO CELULAR, TRIBUTOS,
MANUTENÇÃO, FAXINA, EXTRA, MATERIAL DE LIMP
```

**Volume:** ~300-400 lançamentos/mês, crescendo com novas unidades.

---

## 🚀 Roadmap — Fases em Ordem de Prioridade

### FASE 1 — Core (prioridade máxima)
**Objetivo:** Substituir a planilha caótica por dados estruturados + dashboard funcional.
**Entrega:** Painel web com dashboards, API completa, banco populado com dados históricos.

**O que implementar:**
1. Schema SQL completo + seed com dados de jan–mai 2026 importados do Excel
2. API: auth, lançamentos CRUD, relatórios por categoria/unidade/mês
3. Painel web (Next.js): dashboard com KPIs, gráficos e tabela de lançamentos
4. Sincronização automática com Google Sheets (escrita quando lança, leitura para importar)

**KPIs do dashboard principal:**
- Total gasto no mês vs. mês anterior (variação %)
- Gastos por categoria (gráfico de barras dourado)
- Gastos por unidade (comparativo)
- Top 5 maiores despesas do mês
- Alertas de vencimento próximo (próximos 7 dias)
- Status de pagamentos (% pago vs. pendente)

### FASE 2 — Mobile + Alertas
**Objetivo:** Gestores lançam despesas pelo celular; alertas automáticos de vencimento.

**O que implementar:**
1. App React Native com telas: dashboard, lançamento, histórico, alertas
2. Sistema de alertas: vencimentos de seguros, IPVA, contas recorrentes
3. Notificações push (Expo) e email (Resend) — resumo semanal automático
4. Foto de comprovante (câmera → upload → vinculado ao lançamento)

### FASE 3 — IA Financeira
**Objetivo:** Análise inteligente dos gastos com sugestões de corte.

**O que implementar:**
1. Endpoint `/api/ia/analise` que envia os dados reais do mês para o Claude API
2. Tela de chat financeiro no app e no web
3. Análises automáticas mensais:
   - "Combustível em Terra Rica subiu 23% vs. mês anterior"
   - "Aluguel representa 18% das despesas fixas — média de mercado é 12%"
   - "3 seguros vencem nos próximos 30 dias — total: R$ 856"
   - Sugestão de renegociação de contratos com base no histórico
4. Relatório PDF mensal gerado pela IA com highlights e recomendações

### FASE 4 — Recursos Avançados
- Importação automática de extrato PDF do Sicredi (parser + categorização automática)
- Controle de RPV/Precatório (compras e recebimentos)
- Previsão de caixa para os próximos 3 meses baseada em recorrentes
- Multiempresa (caso o escritório cresça com novos CNPJs)

---

## ✅ Padrões de Código Obrigatórios

### TypeScript — tipagem completa

```ts
// ✅ Correto
interface Lancamento {
  id: string
  descricao: string
  categoriaId: string
  unidadeId: string
  valor: number
  dataLancamento: string          // ISO date
  dataVencimento?: string
  dataPagamento?: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  tipo: 'CAMPO' | 'ADMINISTRATIVO' | 'TRIBUTOS' | 'FOLHA'
  criadoPor: string
  observacoes?: string
}

// ❌ Proibido
const lancamento: any = {}
```

### API Endpoints (Vercel Serverless)

```ts
import { db, requireAuth, cors } from '../_lib'

export default async function handler(req: any, res: any) {
  cors(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const user = requireAuth(req)
    // lógica aqui
  } catch (err) {
    return res.status(401).json({ error: 'Não autorizado' })
  }
}
```

### Hooks (mobile)

```ts
export function useLancamentos(filtros?: FiltrosLancamento) {
  const [data, setData] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const result = await apiFetch('/api/lancamentos', { params: filtros })
      setData(result)
    } catch (e) {
      setError('Erro ao carregar lançamentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [JSON.stringify(filtros)])
  return { data, loading, error, refetch: fetch }
}
```

### Componentes (mobile)

```tsx
interface MetricCardProps {
  titulo: string
  valor: string
  variacao?: number   // positivo = cresceu, negativo = reduziu
  icone?: string
}

export function MetricCard({ titulo, valor, variacao, icone }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.valor}>{valor}</Text>
      {variacao !== undefined && (
        <Text style={[styles.variacao, { color: variacao > 0 ? colors.danger : colors.success }]}>
          {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}% vs. mês anterior
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  titulo: { color: colors.textMuted, fontSize: 12 },
  valor: { color: colors.goldLight, fontSize: 24, fontWeight: '600' },
  variacao: { fontSize: 12, marginTop: 4 },
})
```

---

## 🤖 IA Financeira — Como Implementar

O assistente financeiro recebe os dados reais do banco e gera análises contextualizadas.

```ts
// api/ia/analise.ts
const SYSTEM_PROMPT = `
Você é o assistente financeiro do escritório de advocacia Araujo.
Você analisa dados reais de despesas e gera insights objetivos e acionáveis.

Regras:
- Seja direto e objetivo. Sem enrolação.
- Foque em anomalias, tendências preocupantes e oportunidades de corte.
- Compare sempre com o mês anterior quando os dados permitirem.
- Sugira ações concretas, não genéricas.
- Valores em R$ com separador de milhar.
- Responda sempre em português.

Contexto das unidades:
- Terra Rica (sede), Primavera, Teodoro, Presidente Venceslau, Ivinhema, Narandiba, Euclides
`

// Montar o contexto com dados reais antes de chamar a API
const contexto = {
  mes: '2026-05',
  totalGasto: 185432.90,
  totalMesAnterior: 172100.00,
  variacao: '+7.7%',
  porCategoria: [...],   // dados reais do banco
  porUnidade: [...],
  topDespesas: [...],
  alertasVencimento: [...],
}
```

---

## 🔐 Segurança

- JWT em toda rota autenticada — validar no `_lib.ts` antes de qualquer lógica
- Gestor só acessa dados da própria unidade (`unidade_id = user.unidade`)
- Financeiro/admin acessa tudo
- Nunca logar valores financeiros, CPFs ou tokens
- Validar todos os inputs antes de queries SQL (usar parameterized queries sempre)
- `.env` nunca commitado — usar `.env.example` com chaves vazias

---

## 📝 Variáveis de Ambiente (.env)

```bash
# Banco
DATABASE_URL=postgres://...

# Auth
JWT_SECRET=...

# Google Sheets
GOOGLE_SHEETS_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_KEY=...

# IA
ANTHROPIC_API_KEY=...

# Email
RESEND_API_KEY=...

# Expo Push
EXPO_ACCESS_TOKEN=...
```

---

## ⚠️ Regras Gerais — Sempre Seguir

1. **Nunca usar `any` em TypeScript** — se não sabe o tipo, criar interface
2. **Nunca hardcodar strings de categoria ou unidade** — usar constantes em `types/index.ts`
3. **Sempre tratar erros** — try/catch em toda chamada async, mensagem de erro amigável na UI
4. **Sempre validar permissão no backend** — não confiar só na UI
5. **Sempre usar `apiFetch` de `services/api.ts`** — nunca `fetch` diretamente nas telas
6. **Loading states obrigatórios** — toda tela que busca dados precisa de skeleton/spinner
7. **Componentes reutilizáveis** — se um padrão de UI aparece 2x, vira componente
8. **Comentários em português** — o time é brasileiro

---

## 💬 Como Pedir Ajuda ao Claude Code de Forma Eficiente

Ao iniciar qualquer tarefa, informe:
- Qual fase do roadmap está implementando
- Quais arquivos existentes serão modificados
- Se é backend (API), frontend web (Next.js), mobile (React Native), ou todos
- Se precisa de migração de banco

**Exemplos de prompts ideais:**

> "Fase 1 — Preciso criar o endpoint `GET /api/relatorios/mensal` que retorna
> o total gasto por categoria no mês, comparando com o mês anterior. Backend apenas.
> O helper de db está em `api/_lib.ts`."

> "Fase 1 — Preciso criar a tela de dashboard no painel web (Next.js) com 4 MetricCards
> no topo (total do mês, variação, maior categoria, alertas pendentes) e um gráfico de
> barras com gastos por categoria. Usar dados do endpoint `/api/relatorios/mensal`."

> "Fase 3 — Preciso implementar o endpoint `/api/ia/analise` que busca os dados
> do mês atual no banco, monta o contexto e chama o Claude API para gerar a análise.
> A chave está em `.env` como `ANTHROPIC_API_KEY`."

---

## 📋 Checklist Antes de Finalizar Qualquer Tarefa

- [ ] O código tem tipagem completa (sem `any`)?
- [ ] Todos os erros são tratados com try/catch?
- [ ] Há loading state na UI?
- [ ] Validação de permissão no backend?
- [ ] Nenhuma credencial hardcoded?
- [ ] Componentes com mais de 40 linhas foram decompostos?
- [ ] `docs/changelog.md` foi atualizado?
- [ ] Os tipos foram adicionados em `types/index.ts`?

---

## 🎯 Primeira Tarefa Sugerida para Começar

**Executar nesta ordem:**

1. Criar o `schema/schema.sql` completo baseado no schema acima
2. Criar `api/_lib.ts` com helpers de db, auth e cors
3. Criar `types/index.ts` com todas as interfaces TypeScript
4. Criar `theme/index.ts` com o design system azul marinho + dourado
5. Implementar `api/auth/login.ts`
6. Implementar `api/lancamentos/index.ts` (GET + POST)
7. Criar o painel web com o dashboard principal
8. Configurar sync com Google Sheets

---

*Gestor Financeiro · Planejar · Gerir · Fazer Crescer · 2026*
