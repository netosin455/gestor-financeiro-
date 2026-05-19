'use client'

interface MetricCardProps {
  titulo:    string
  valor:     string
  subtitulo?: string
  variacao?: number   // positivo = cresceu, negativo = reduziu (em %)
  icone?:    string
  cor?:      string
}

export function MetricCard({ titulo, valor, subtitulo, variacao, icone, cor }: MetricCardProps) {
  const variacaoColor = variacao !== undefined
    ? variacao > 0 ? '#C0392B' : variacao < 0 ? '#27AE60' : '#8B9BB4'
    : undefined

  const variacaoTexto = variacao !== undefined
    ? `${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}% vs. mês anterior`
    : undefined

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        {icone && <span style={{ fontSize: 20 }}>{icone}</span>}
        <span style={styles.titulo}>{titulo}</span>
      </div>
      <div style={{ ...styles.valor, ...(cor ? { color: cor } : {}) }}>
        {valor}
      </div>
      {subtitulo && <div style={styles.subtitulo}>{subtitulo}</div>}
      {variacaoTexto && (
        <div style={{ ...styles.variacao, color: variacaoColor }}>
          {variacaoTexto}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#111827',
    borderRadius:    12,
    border:          '1px solid #1E2A3A',
    padding:         '20px 24px',
    display:         'flex',
    flexDirection:   'column',
    gap:             6,
  },
  header: {
    display:    'flex',
    alignItems: 'center',
    gap:         8,
  },
  titulo: {
    color:    '#8B9BB4',
    fontSize: 13,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  valor: {
    color:      '#E2C97E',
    fontSize:   28,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitulo: {
    color:    '#8B9BB4',
    fontSize: 13,
  },
  variacao: {
    fontSize:   12,
    fontWeight: 500,
  },
}
