'use client'

import type { KpiAlerta } from '../../types'
import { formatCurrency } from '../../theme'

interface AlertaCardProps {
  alerta: KpiAlerta
}

export function AlertaCard({ alerta }: AlertaCardProps) {
  const cor = alerta.dias_restantes <= 0
    ? '#C0392B'
    : alerta.dias_restantes <= 2
    ? '#E67E22'
    : '#E67E22'

  const label = alerta.dias_restantes < 0
    ? `Atrasado ${Math.abs(alerta.dias_restantes)} dias`
    : alerta.dias_restantes === 0
    ? 'Vence hoje'
    : `${alerta.dias_restantes} dia${alerta.dias_restantes > 1 ? 's' : ''}`

  return (
    <div style={{ ...styles.card, borderLeftColor: cor }}>
      <div style={styles.row}>
        <div style={styles.info}>
          <span style={styles.descricao}>{alerta.descricao}</span>
          <span style={styles.categoria}>{alerta.categoria}</span>
        </div>
        <div style={styles.direita}>
          <span style={styles.valor}>{formatCurrency(alerta.valor)}</span>
          <span style={{ ...styles.label, color: cor }}>{label}</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#111827',
    borderRadius:    8,
    border:          '1px solid #1E2A3A',
    borderLeft:      '3px solid',
    padding:         '12px 16px',
  },
  row: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    gap:            16,
  },
  info: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    flex:          1,
  },
  descricao: {
    color:    '#F2F0EA',
    fontSize: 14,
  },
  categoria: {
    color:    '#8B9BB4',
    fontSize: 12,
  },
  direita: {
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'flex-end',
    gap:           4,
  },
  valor: {
    color:      '#E2C97E',
    fontSize:   14,
    fontWeight: 600,
  },
  label: {
    fontSize:   12,
    fontWeight: 500,
  },
}
