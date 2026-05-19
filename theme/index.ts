// ============================================================
// GESTOR FINANCEIRO — Design System
// Identidade: Azul Marinho Escuro + Dourado
// Slogan: Planejar · Gerir · Fazer Crescer
// ============================================================

export const colors = {
  // Backgrounds
  bg:        '#0A0E1A',   // Azul muito escuro — background principal
  surface:   '#111827',   // Superfície de cards e modais
  border:    '#1E2A3A',   // Bordas sutis

  // Cores principais — identidade visual
  navy:      '#1E3A5F',   // Azul marinho — elementos secundários
  navyLight: '#2E5080',   // Azul médio — hover states

  gold:      '#C9A84C',   // Dourado principal — CTAs, ícones ativos
  goldLight: '#E2C97E',   // Dourado claro — textos em destaque
  goldDim:   '#7A6230',   // Dourado escuro — estados desabilitados

  // Texto
  text:      '#F2F0EA',   // Off-white quente — texto principal
  textMuted: '#8B9BB4',   // Texto secundário / labels

  // Semânticas
  danger:    '#C0392B',   // Vermelho — erros, alertas críticos, ATRASADO
  warning:   '#E67E22',   // Laranja — avisos, vencendo em breve, PENDENTE
  success:   '#27AE60',   // Verde — confirmações, PAGO
  info:      '#2980B9',   // Azul — informações neutras
} as const

export type ColorKey = keyof typeof colors

// Mapa de status → cor
export const statusColors: Record<string, string> = {
  pago:      colors.success,
  pendente:  colors.warning,
  atrasado:  colors.danger,
  vencendo:  colors.warning,
  cancelado: colors.textMuted,
}

// Mapa de grupo de categoria → cor
export const grupoCores: Record<string, string> = {
  folha:         colors.gold,
  tributos:      '#E67E22',
  operacional:   colors.navyLight,
  administrativo: colors.textMuted,
  campo:         colors.success,
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const

export const radius = {
  sm:   8,
  md:  12,
  lg:  16,
  full: 999,
} as const

export const fontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   18,
  xl:   24,
  xxl:  32,
} as const

export const fontWeight = {
  regular: '400',
  medium:  '500',
  semibold:'600',
  bold:    '700',
} as const

// Estilos de card padrão (mobile — StyleSheet.create)
export const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius:    radius.md,
  borderWidth:     1,
  borderColor:     colors.border,
  padding:         spacing.md,
} as const

// Formatadores de valor monetário
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style:                 'currency',
    currency:              'BRL',
    minimumFractionDigits: 2,
  })
}

export function formatVariacao(percent: number): string {
  const sinal = percent > 0 ? '+' : ''
  return `${sinal}${percent.toFixed(1)}%`
}

export function variacaoColor(percent: number): string {
  if (percent > 0) return colors.danger   // cresceu = gasto mais = ruim
  if (percent < 0) return colors.success  // reduziu = economizou = bom
  return colors.textMuted
}
