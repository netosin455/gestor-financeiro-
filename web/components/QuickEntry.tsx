'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Categoria { id: string; nome: string; grupo: string }

const ATALHOS = [
  { tecla: 'N', descricao: 'Novo lançamento rápido' },
  { tecla: '?', descricao: 'Mostrar atalhos de teclado' },
  { tecla: 'Esc', descricao: 'Fechar modal aberto' },
]

const hoje = () => new Date().toISOString().slice(0, 10)

export function QuickEntry() {
  const { token, user } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'err'; msg: string } | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const [tipo, setTipo] = useState<'saida' | 'entrada'>('saida')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hoje())

  const podeEditar = user && ['super_admin', 'admin', 'financeiro'].includes(user.role)

  useEffect(() => {
    if (!aberto || !token) return
    apiFetch<{ data: { categorias: Categoria[] } }>(
      '/api/lancamentos', { params: { meta: '1' } }, token
    ).then(r => setCategorias(r.data.categorias)).catch(() => {})
  }, [aberto, token])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase()
      const editavel = tag === 'input' || tag === 'textarea' || tag === 'select'

      if (e.key === 'Escape') {
        setAberto(false)
        setAjudaAberta(false)
        return
      }
      if (editavel) return

      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && podeEditar) {
        setAberto(true)
      }
      if (e.key === '?') {
        setAjudaAberta(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [podeEditar])

  const categoriasVisiveis = categorias.filter(c =>
    tipo === 'entrada' ? c.grupo === 'entrada' : c.grupo !== 'entrada'
  )

  const resetForm = () => {
    setTipo('saida')
    setDescricao('')
    setCategoriaId('')
    setValor('')
    setData(hoje())
    setFeedback(null)
  }

  const fechar = () => { setAberto(false); resetForm() }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim()) return setFeedback({ tipo: 'err', msg: 'Descrição obrigatória' })
    if (!categoriaId) return setFeedback({ tipo: 'err', msg: 'Selecione uma categoria' })
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) return setFeedback({ tipo: 'err', msg: 'Valor inválido' })

    setSalvando(true)
    try {
      await apiFetch('/api/lancamentos', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          descricao: descricao.trim(),
          categoria_id: categoriaId,
          valor: valorNum,
          data_lancamento: data,
          status: tipo === 'entrada' ? 'pago' : 'pendente',
          pago: tipo === 'entrada',
        }),
      }, token!)
      setFeedback({ tipo: 'ok', msg: `${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada com sucesso!` })
      setTimeout(fechar, 1200)
    } catch (err) {
      setFeedback({ tipo: 'err', msg: err instanceof Error ? err.message : 'Erro ao salvar' })
    } finally {
      setSalvando(false)
    }
  }

  if (!podeEditar) return null

  return (
    <>
      {/* FAB */}
      <button
        title="Novo lançamento rápido (tecla N)"
        onClick={() => setAberto(true)}
        style={{
          position: 'fixed', bottom: 88, right: 24,
          width: 48, height: 48, borderRadius: '50%',
          backgroundColor: '#C9A84C', border: 'none',
          color: '#0A0E1A', fontSize: 24, fontWeight: 700,
          cursor: 'pointer', zIndex: 900,
          boxShadow: '0 4px 20px rgba(201,168,76,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
        }}
      >
        +
      </button>

      {/* Modal Lançamento Rápido */}
      {aberto && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={fechar}
        >
          <div
            style={{ backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ color: '#E2C97E', margin: 0, fontSize: 16, fontWeight: 700 }}>⚡ Lançamento Rápido</h3>
              <button onClick={fechar} style={{ background: 'none', border: 'none', color: '#8B9BB4', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Toggle tipo */}
              <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #1E2A3A' }}>
                {(['saida', 'entrada'] as const).map(t => (
                  <button key={t} type="button"
                    onClick={() => { setTipo(t); setCategoriaId('') }}
                    style={{
                      flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', border: 'none', transition: 'all 0.12s',
                      backgroundColor: tipo === t ? (t === 'saida' ? '#C0392B22' : '#27AE6022') : '#0D1520',
                      color: tipo === t ? (t === 'saida' ? '#C0392B' : '#27AE60') : '#8B9BB4',
                      borderBottom: tipo === t ? `2px solid ${t === 'saida' ? '#C0392B' : '#27AE60'}` : 'none',
                    }}>
                    {t === 'saida' ? '💸 Saída' : '💰 Entrada'}
                  </button>
                ))}
              </div>

              {/* Descrição */}
              <div>
                <label style={lbl}>Descrição *</label>
                <input
                  autoFocus
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Conta de energia"
                  style={inp}
                />
              </div>

              {/* Categoria + Valor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Categoria *</label>
                  <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} style={inp}>
                    <option value="">Selecione...</option>
                    {categoriasVisiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Valor (R$) *</label>
                  <input type="number" step="0.01" min="0.01"
                    value={valor} onChange={e => setValor(e.target.value)}
                    placeholder="0,00" style={inp} />
                </div>
              </div>

              {/* Data */}
              <div>
                <label style={lbl}>Data</label>
                <input type="date" value={data} onChange={e => setData(e.target.value)} style={inp} />
              </div>

              {/* Feedback inline */}
              {feedback && (
                <div style={{
                  padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  backgroundColor: feedback.tipo === 'ok' ? '#0D2018' : '#3D1515',
                  color: feedback.tipo === 'ok' ? '#27AE60' : '#E57373',
                  border: `1px solid ${feedback.tipo === 'ok' ? '#27AE60' : '#C0392B'}`,
                }}>
                  {feedback.tipo === 'ok' ? '✅ ' : '⚠️ '}{feedback.msg}
                </div>
              )}

              {/* Botões */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 2 }}>
                <button type="button" onClick={fechar}
                  style={{ backgroundColor: 'transparent', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  style={{ backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.7 : 1 }}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Painel de Atalhos (?) */}
      {ajudaAberta && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setAjudaAberta(false)}
        >
          <div
            style={{ backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12, padding: 24, minWidth: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#E2C97E', margin: 0, fontSize: 15, fontWeight: 700 }}>⌨️ Atalhos de Teclado</h3>
              <button onClick={() => setAjudaAberta(false)} style={{ background: 'none', border: 'none', color: '#8B9BB4', fontSize: 16, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ATALHOS.map(a => (
                <div key={a.tecla} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <span style={{ color: '#8B9BB4', fontSize: 13 }}>{a.descricao}</span>
                  <kbd style={{
                    backgroundColor: '#0D1520', border: '1px solid #1E2A3A',
                    color: '#E2C97E', borderRadius: 5, padding: '2px 8px',
                    fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap',
                  }}>{a.tecla}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const lbl: React.CSSProperties = { color: '#8B9BB4', fontSize: 12, display: 'block', marginBottom: 4 }
const inp: React.CSSProperties = {
  backgroundColor: '#0D1520', border: '1px solid #1E2A3A',
  color: '#F2F0EA', borderRadius: 8, padding: '9px 12px',
  fontSize: 14, width: '100%', boxSizing: 'border-box',
}
