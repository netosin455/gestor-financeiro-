// ============================================================
// GESTOR FINANCEIRO — Tipos TypeScript Centralizados
// ============================================================

// ------- Roles e permissões -------

export type Role = 'super_admin' | 'admin' | 'financeiro' | 'gestor'

// ------- Status -------

export type StatusLancamento = 'pendente' | 'pago' | 'atrasado' | 'cancelado'
export type StatusCalculado  = 'pago' | 'atrasado' | 'vencendo' | 'pendente'

// ------- Setores (seção C da planilha) -------

export type TipoSetor =
  | 'ADMINISTRATIVO'
  | 'CAMPO'
  | 'FOLHA DE PAGAMENTOS'
  | 'TRIBUTOS'

// ------- Categorias (14 mapeadas do Excel) -------

export type CategoriaNome =
  | 'FOLHA DE PAGAMENTOS'
  | 'TRIBUTOS'
  | 'EXTRA'
  | 'ALUGUEL'
  | 'COMBUSTÍVEL'
  | 'FINANCIAMENTO'
  | 'ENERGIA'
  | 'PLANO CELULAR'
  | 'ÁGUA'
  | 'MANUTENÇÃO'
  | 'SEGURO'
  | 'FAXINA'
  | 'INTERNET'
  | 'MATERIAL DE LIMPEZA'

export type GrupoCategoria = 'operacional' | 'administrativo' | 'campo' | 'folha' | 'tributos'

// ------- Entidades principais -------

export interface User {
  id: string
  name: string
  email: string
  role: Role
  unidade: string | null
  active: boolean
  created_at: string
}

export interface UserJWT {
  id: string
  email: string
  role: Role
  unidade: string | null
}

export interface Unidade {
  id: string
  nome: string
  cidade: string | null
  estado: string | null
  tipo: 'escritorio' | 'campo'
  active: boolean
}

export interface Categoria {
  id: string
  nome: CategoriaNome
  grupo: GrupoCategoria
  cor: string
}

export interface Lancamento {
  id: string
  descricao: string
  categoria_id: string
  unidade_id: string | null
  valor: number
  setor: TipoSetor | null
  data_lancamento: string    // ISO date "YYYY-MM-DD"
  data_vencimento: string | null
  data_pagamento: string | null
  status: StatusLancamento
  pago: boolean
  solicitado: boolean
  mes_referencia: string     // "YYYY-MM"
  criado_por: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface LancamentoComDetalhes extends Lancamento {
  categoria_nome: CategoriaNome
  categoria_grupo: GrupoCategoria
  categoria_cor: string
  unidade_nome: string | null
  unidade_tipo: 'escritorio' | 'campo' | null
  status_calculado: StatusCalculado
}

// ------- Frota -------

export interface Frota {
  id: string
  nome: string    // "MOBI 01"
  placa: string | null
  proprietario: string | null
  motorista_principal: string | null
  active: boolean
}

export interface Motorista {
  id: string
  nome: string
  unidade_id: string | null
  active: boolean
}

export interface Abastecimento {
  id: string
  frota_id: string
  motorista_id: string | null
  valor: number
  data_abastecimento: string
  mes_referencia: string
  unidade_id: string | null
  created_at: string
}

export interface AbastecimentoComDetalhes extends Abastecimento {
  frota_nome: string
  motorista_nome: string | null
  unidade_nome: string | null
}

// ------- Seguros -------

export interface Seguro {
  id: string
  frota_id: string | null
  proprietario: string | null
  valor_parcela: number | null
  num_parcelas: number | null
  data_vencimento: string | null
  forma_pagamento: string | null
  corretora: string | null
  local_debito: string | null
  seguradora: string | null
  active: boolean
}

// ------- Relatórios / KPIs -------

export interface KpiDashboard {
  totalMes: number
  totalMesAnterior: number
  variacaoPercent: number
  porCategoria: KpiCategoria[]
  porUnidade: KpiUnidade[]
  top5Despesas: KpiTopDespesa[]
  alertasVencimento: KpiAlerta[]
  percentPago: number
  totalPendente: number
  totalLancamentos: number
}

export interface KpiCategoria {
  nome: CategoriaNome
  valor: number
  percent: number
  cor: string
}

export interface KpiUnidade {
  nome: string
  valor: number
}

export interface KpiTopDespesa {
  descricao: string
  valor: number
  categoria: CategoriaNome
}

export interface KpiAlerta {
  id: string
  descricao: string
  valor: number
  data_vencimento: string
  dias_restantes: number
  categoria: CategoriaNome
}

// ------- Filtros -------

export interface FiltrosLancamento {
  mes?: string           // "YYYY-MM"
  categoriaId?: string
  unidadeId?: string
  status?: StatusLancamento
  setor?: TipoSetor
  page?: number
  limit?: number
}

// ------- Respostas da API -------

export interface ApiResponse<T> {
  data: T
  error?: never
}

export interface ApiError {
  error: string
  data?: never
}

export type ApiResult<T> = ApiResponse<T> | ApiError

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ------- Auth -------

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: Omit<User, 'password_hash'>
}

// ------- Formulários (criação/edição) -------

export interface LancamentoCreate {
  descricao: string
  categoria_id: string
  unidade_id?: string
  valor: number
  setor?: TipoSetor
  data_lancamento: string
  data_vencimento?: string
  data_pagamento?: string
  status?: StatusLancamento
  pago?: boolean
  solicitado?: boolean
  observacoes?: string
}

export interface LancamentoUpdate extends Partial<LancamentoCreate> {
  id: string
}
