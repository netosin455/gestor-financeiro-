'use client'

import { useState, useRef, useEffect } from 'react'
import { apiFetch } from '../services/api'

interface Msg {
  role: 'user' | 'ia'
  text: string
}

interface Props {
  token: string
  mes: string
  kpiDados?: object
}

export function ChatIA({ token, mes, kpiDados }: Props) {
  const [aberto, setAberto]       = useState(false)
  const [msgs, setMsgs]           = useState<Msg[]>([])
  const [pergunta, setPergunta]   = useState('')
  const [carregando, setCarregando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function enviar() {
    const texto = pergunta.trim()
    if (!texto || carregando) return

    const novaMsgs: Msg[] = [...msgs, { role: 'user', text: texto }]
    setMsgs(novaMsgs)
    setPergunta('')
    setCarregando(true)

    try {
      const res = await apiFetch<{ data: { resposta: string } }>('/api/ia', {
        method: 'POST',
        body: JSON.stringify({ tipo: 'chat', mes, dados: kpiDados, pergunta: texto }),
      }, token)
      setMsgs(prev => [...prev, { role: 'ia', text: res.data.resposta }])
    } catch (e) {
      setMsgs(prev => [...prev, { role: 'ia', text: '⚠️ ' + (e instanceof Error ? e.message : 'Erro ao consultar IA') }])
    } finally {
      setCarregando(false)
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      <button style={S.fab} onClick={() => setAberto(o => !o)} title="Assistente IA">
        {aberto ? '✕' : '🤖'}
      </button>

      {/* Painel de chat */}
      {aberto && (
        <div style={S.panel}>
          <div style={S.header}>
            <span style={S.headerTitle}>Assistente Financeiro IA</span>
            <span style={S.headerSub}>Powered by Claude</span>
          </div>

          <div style={S.messages}>
            {msgs.length === 0 && (
              <div style={S.emptyState}>
                <span style={{ fontSize: 28 }}>💬</span>
                <span style={{ color: '#8B9BB4', fontSize: 13, textAlign: 'center' }}>
                  Pergunte sobre os dados financeiros do mês atual
                </span>
                <div style={S.sugestoes}>
                  {[
                    'Quais são os maiores gastos do mês?',
                    'Como está o saldo em relação ao mês anterior?',
                    'Tem algum vencimento urgente?',
                  ].map(s => (
                    <button key={s} style={S.sugestao} onClick={() => { setPergunta(s) }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{ ...S.msg, ...(m.role === 'user' ? S.msgUser : S.msgIA) }}>
                {m.text}
              </div>
            ))}

            {carregando && (
              <div style={{ ...S.msg, ...S.msgIA }}>
                <span style={S.typing}>●●●</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={S.inputArea}>
            <input
              style={S.input}
              value={pergunta}
              onChange={e => setPergunta(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Pergunte sobre as finanças..."
              disabled={carregando}
            />
            <button style={S.btnEnviar} onClick={enviar} disabled={carregando || !pergunta.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', bottom: 24, right: 24, zIndex: 998,
    width: 52, height: 52, borderRadius: '50%',
    backgroundColor: '#C9A84C', border: 'none', fontSize: 22,
    cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    position: 'fixed', bottom: 88, right: 24, zIndex: 997,
    width: 360, height: 480,
    backgroundColor: '#111827', border: '1px solid #1E2A3A',
    borderRadius: 16, display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  header: {
    padding: '14px 18px', borderBottom: '1px solid #1E2A3A',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  headerTitle: { color: '#E2C97E', fontWeight: 700, fontSize: 14 },
  headerSub:   { color: '#8B9BB4', fontSize: 11 },
  messages: {
    flex: 1, overflowY: 'auto', padding: 16,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, padding: '20px 8px',
  },
  sugestoes: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' },
  sugestao: {
    background: '#1E2A3A', border: 'none', borderRadius: 8,
    color: '#8B9BB4', fontSize: 12, padding: '8px 12px',
    textAlign: 'left', cursor: 'pointer',
  },
  msg: {
    maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
    fontSize: 13, lineHeight: 1.5,
  },
  msgUser: {
    alignSelf: 'flex-end', backgroundColor: '#C9A84C22',
    color: '#F2F0EA', borderBottomRightRadius: 4,
    border: '1px solid #C9A84C44',
  },
  msgIA: {
    alignSelf: 'flex-start', backgroundColor: '#1E2A3A',
    color: '#F2F0EA', borderBottomLeftRadius: 4,
  },
  typing: { color: '#8B9BB4', letterSpacing: 4 },
  inputArea: {
    padding: '12px 14px', borderTop: '1px solid #1E2A3A',
    display: 'flex', gap: 8, alignItems: 'center',
  },
  input: {
    flex: 1, backgroundColor: '#0D1520', border: '1px solid #1E2A3A',
    color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 13,
  },
  btnEnviar: {
    backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A',
    borderRadius: 8, width: 36, height: 36, cursor: 'pointer',
    fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
