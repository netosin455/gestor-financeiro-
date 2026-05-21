'use client'

interface Props {
  icone: string
  titulo: string
  descricao?: string
  acaoLabel?: string
  onAcao?: () => void
}

export function EmptyState({ icone, titulo, descricao, acaoLabel, onAcao }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '52px 24px', gap: 12,
      color: '#8B9BB4', textAlign: 'center',
    }}>
      <span style={{ fontSize: 48, lineHeight: 1 }}>{icone}</span>
      <span style={{ color: '#F2F0EA', fontSize: 15, fontWeight: 600 }}>{titulo}</span>
      {descricao && (
        <span style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>{descricao}</span>
      )}
      {acaoLabel && onAcao && (
        <button
          onClick={onAcao}
          style={{
            marginTop: 8,
            backgroundColor: '#C9A84C', border: 'none',
            color: '#0A0E1A', borderRadius: 8, padding: '9px 20px',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {acaoLabel}
        </button>
      )}
    </div>
  )
}
