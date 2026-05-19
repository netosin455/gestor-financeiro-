'use client'

import type { KpiCategoria } from '../../types'
import { formatCurrency } from '../../theme'

interface GraficoBarrasProps {
  dados:  KpiCategoria[]
  titulo?: string
}

export function GraficoBarras({ dados, titulo }: GraficoBarrasProps) {
  const maxValor = Math.max(...dados.map(d => d.valor), 1)

  return (
    <div style={styles.container}>
      {titulo && <h3 style={styles.titulo}>{titulo}</h3>}
      <div style={styles.lista}>
        {dados.map(item => (
          <div key={item.nome} style={styles.item}>
            <div style={styles.labelRow}>
              <span style={styles.label}>{item.nome}</span>
              <span style={styles.valor}>{formatCurrency(item.valor)}</span>
            </div>
            <div style={styles.barraContainer}>
              <div
                style={{
                  ...styles.barra,
                  width:           `${(item.valor / maxValor) * 100}%`,
                  backgroundColor: item.cor ?? '#C9A84C',
                }}
              />
            </div>
            <span style={styles.percent}>{item.percent.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#111827',
    borderRadius:    12,
    border:          '1px solid #1E2A3A',
    padding:         '20px 24px',
  },
  titulo: {
    color:        '#E2C97E',
    fontSize:     16,
    fontWeight:   600,
    marginBottom: 20,
    margin:       '0 0 20px 0',
  },
  lista: {
    display:       'flex',
    flexDirection: 'column',
    gap:           12,
  },
  item: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
  },
  labelRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  label: {
    color:    '#F2F0EA',
    fontSize: 13,
  },
  valor: {
    color:      '#E2C97E',
    fontSize:   13,
    fontWeight: 600,
  },
  barraContainer: {
    backgroundColor: '#1E2A3A',
    borderRadius:    4,
    height:          8,
    overflow:        'hidden',
  },
  barra: {
    height:       '100%',
    borderRadius: 4,
    transition:   'width 0.4s ease',
  },
  percent: {
    color:    '#8B9BB4',
    fontSize: 11,
  },
}
