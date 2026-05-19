'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { ToastContainer, useToast } from '../../components/Toast'
import { formatCurrency } from '../../../theme'

interface Seguro {
  id: string
  frota_id: string | null
  frota_nome: string | null
  frota_placa: string | null
  proprietario: string | null
  valor_parcela: number | null
  num_parcelas: number | null
  data_vencimento: string | null
  forma_pagamento: string | null
  corretora: string | null
  local_debito: string | null
  seguradora: string | null
  active: boolean
  created_at: string
}

interface FrotaOpcao {
  id: string
  nome: string
  placa: string | null
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function diasParaVencer(iso: string | null): number | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

export default function SegurosPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toasts, toast } = useToast()

  const [seguros, setSeguros] = useState<Seguro[]>([])
  const [frotaOpcoes, setFrotaOpcoes] = useState<FrotaOpcao[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  // Modal
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Seguro | null>(null)
  const [salvando, setSalvando]       = useState(false)

  // Form
  const [fFrota, setFFrota]               = useState('')
  const [fProprietario, setFProprietario] = useState('')
  const [fValorParcela, setFValorParcela] = useState('')
  const [fNumParcelas, setFNumParcelas]   = useState('')
  const [fVencimento, setFVencimento]     = useState('')
  const [fFormaPagto, setFFormaPagto]     = useState('')
  const [fCorretora, setFCorretora]       = useState('')
  const [fLocalDebito, setFLocalDebito]   = useState('')
  const [fSeguradora, setFSeguradora]     = useState('')

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [segRes, frotaRes] = await Promise.all([
        apiFetch<{ data: Seguro[] }>('/api/seguros', { params: { active: mostrarInativos ? 'false' : undefined } }, token),
        apiFetch<{ data: FrotaOpcao[] }>('/api/operacional', { params: { recurso: 'frota' } }, token),
      ])
      setSeguros(segRes.data)
      setFrotaOpcoes(frotaRes.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar seguros')
    } finally {
      setLoading(false)
    }
  }, [token, mostrarInativos])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setFFrota(''); setFProprietario(''); setFValorParcela('')
    setFNumParcelas(''); setFVencimento(''); setFFormaPagto('')
    setFCorretora(''); setFLocalDebito(''); setFSeguradora('')
    setModalAberto(true)
  }

  function abrirEditar(s: Seguro) {
    setEditando(s)
    setFFrota(s.frota_id ?? '')
    setFProprietario(s.proprietario ?? '')
    setFValorParcela(s.valor_parcela !== null ? String(s.valor_parcela) : '')
    setFNumParcelas(s.num_parcelas !== null ? String(s.num_parcelas) : '')
    setFVencimento(s.data_vencimento ? s.data_vencimento.slice(0, 10) : '')
    setFFormaPagto(s.forma_pagamento ?? '')
    setFCorretora(s.corretora ?? '')
    setFLocalDebito(s.local_debito ?? '')
    setFSeguradora(s.seguradora ?? '')
    setModalAberto(true)
  }

  async function salvar() {
    const valParcela = parseFloat(fValorParcela.replace(',', '.'))
    const numParcelas = parseInt(fNumParcelas, 10)
    if (!valParcela || valParcela <= 0) return toast.error('Valor da parcela é obrigatório')
    if (!numParcelas || numParcelas <= 0) return toast.error('Número de parcelas é obrigatório')

    setSalvando(true)
    try {
      const body = {
        frota_id:        fFrota        || null,
        proprietario:    fProprietario || null,
        valor_parcela:   valParcela,
        num_parcelas:    numParcelas,
        data_vencimento: fVencimento   || null,
        forma_pagamento: fFormaPagto   || null,
        corretora:       fCorretora    || null,
        local_debito:    fLocalDebito  || null,
        seguradora:      fSeguradora   || null,
      }
      if (editando) {
        await apiFetch(`/api/seguros/${editando.id}`, { method: 'PUT', body: JSON.stringify(body) }, token!)
        toast.success('Seguro atualizado!')
      } else {
        await apiFetch('/api/seguros', { method: 'POST', body: JSON.stringify(body) }, token!)
        toast.success('Seguro cadastrado!')
      }
      setModalAberto(false)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function desativar(s: Seguro) {
    if (!isAdmin) return
    if (!confirm(`Desativar seguro de "${s.frota_nome ?? s.proprietario ?? 'Sem veículo'}"?`)) return
    try {
      await apiFetch(`/api/seguros/${s.id}`, { method: 'DELETE' }, token!)
      toast.success('Seguro desativado')
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  if (authLoading || !user) return null

  const totalMensal = seguros.reduce((s, seg) => s + Number(seg.valor_parcela ?? 0), 0)

  return (
    <div style={S.layout}>
      <Sidebar />
      <ToastContainer toasts={toasts} />

      <main style={S.main}>
        <div style={S.pageHeader}>
          <div>
            <h1 style={S.titulo}>Seguros</h1>
            <p style={S.subtitulo}>{seguros.length} seguro{seguros.length !== 1 ? 's' : ''} · Total mensal: {formatCurrency(totalMensal)}</p>
          </div>
          <div style={S.headerAcoes}>
            <label style={S.toggleLabel}>
              <input
                type="checkbox"
                checked={mostrarInativos}
                onChange={e => setMostrarInativos(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Mostrar inativos
            </label>
            {isAdmin && (
              <button style={S.btnNovo} onClick={abrirNovo}>+ Novo Seguro</button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={S.loading}>Carregando...</div>
        ) : seguros.length === 0 ? (
          <div style={S.vazio}>
            <span style={{ fontSize: 40 }}>🛡️</span>
            <span style={{ color: '#8B9BB4' }}>Nenhum seguro cadastrado</span>
          </div>
        ) : (
          <div style={S.tabelaWrap}>
            <table style={S.tabela}>
              <thead>
                <tr>
                  {['Veículo / Proprietário', 'Seguradora', 'Vencimento', 'Parcela', 'Parcelas', 'Local Débito', 'Status', ''].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seguros.map(s => {
                  const dias = diasParaVencer(s.data_vencimento)
                  const urgencia = dias === null ? 'normal' : dias < 0 ? 'atrasado' : dias <= 7 ? 'vencendo' : 'normal'
                  const corDias = urgencia === 'atrasado' ? '#C0392B' : urgencia === 'vencendo' ? '#E67E22' : '#8B9BB4'
                  return (
                    <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 600, color: '#F2F0EA' }}>{s.frota_nome ?? '—'}</div>
                        {s.frota_placa && <div style={{ fontSize: 11, color: '#E2C97E', fontFamily: 'monospace' }}>{s.frota_placa}</div>}
                        {s.proprietario && <div style={{ fontSize: 11, color: '#8B9BB4' }}>{s.proprietario}</div>}
                      </td>
                      <td style={S.td}>{s.seguradora ?? '—'}</td>
                      <td style={{ ...S.td, color: corDias }}>
                        {formatData(s.data_vencimento)}
                        {dias !== null && Math.abs(dias) <= 30 && (
                          <div style={{ fontSize: 11 }}>
                            {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Hoje' : `${dias}d`}
                          </div>
                        )}
                      </td>
                      <td style={{ ...S.td, color: '#E2C97E', fontWeight: 700 }}>{s.valor_parcela !== null ? formatCurrency(Number(s.valor_parcela)) : '—'}</td>
                      <td style={S.td}>{s.num_parcelas ?? '—'}</td>
                      <td style={S.td}>{s.local_debito ?? '—'}</td>
                      <td style={S.td}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, backgroundColor: s.active ? '#27AE6020' : '#C0392B20', color: s.active ? '#27AE60' : '#C0392B' }}>
                          {s.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={S.td}>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button style={S.btnAcao} onClick={() => abrirEditar(s)}>Editar</button>
                            {s.active && <button style={{ ...S.btnAcao, color: '#C0392B' }} onClick={() => desativar(s)}>Excluir</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal */}
      {modalAberto && (
        <div style={S.overlay} onClick={() => setModalAberto(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitulo}>{editando ? 'Editar Seguro' : 'Novo Seguro'}</h2>
              <button style={S.btnFechar} onClick={() => setModalAberto(false)}>✕</button>
            </div>
            <div style={S.form}>
              <div style={S.linha2}>
                <div style={S.grupo}>
                  <label style={S.label}>Veículo</label>
                  <select style={S.input} value={fFrota} onChange={e => setFFrota(e.target.value)}>
                    <option value="">Sem veículo</option>
                    {frotaOpcoes.map(f => (
                      <option key={f.id} value={f.id}>{f.nome}{f.placa ? ` (${f.placa})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div style={S.grupo}>
                  <label style={S.label}>Proprietário</label>
                  <input style={S.input} value={fProprietario} onChange={e => setFProprietario(e.target.value)} placeholder="Nome do proprietário" />
                </div>
              </div>
              <div style={S.linha2}>
                <div style={S.grupo}>
                  <label style={S.label}>Valor da Parcela *</label>
                  <input style={S.input} type="number" step="0.01" value={fValorParcela} onChange={e => setFValorParcela(e.target.value)} placeholder="0,00" />
                </div>
                <div style={S.grupo}>
                  <label style={S.label}>Nº de Parcelas *</label>
                  <input style={S.input} type="number" value={fNumParcelas} onChange={e => setFNumParcelas(e.target.value)} placeholder="12" />
                </div>
              </div>
              <div style={S.linha2}>
                <div style={S.grupo}>
                  <label style={S.label}>Vencimento</label>
                  <input style={S.input} type="date" value={fVencimento} onChange={e => setFVencimento(e.target.value)} />
                </div>
                <div style={S.grupo}>
                  <label style={S.label}>Forma de Pagamento</label>
                  <input style={S.input} value={fFormaPagto} onChange={e => setFFormaPagto(e.target.value)} placeholder="Débito automático" />
                </div>
              </div>
              <div style={S.linha2}>
                <div style={S.grupo}>
                  <label style={S.label}>Seguradora</label>
                  <input style={S.input} value={fSeguradora} onChange={e => setFSeguradora(e.target.value)} placeholder="Porto Seguro" />
                </div>
                <div style={S.grupo}>
                  <label style={S.label}>Corretora</label>
                  <input style={S.input} value={fCorretora} onChange={e => setFCorretora(e.target.value)} placeholder="Nome da corretora" />
                </div>
              </div>
              <div style={S.grupo}>
                <label style={S.label}>Local de Débito</label>
                <input style={S.input} value={fLocalDebito} onChange={e => setFLocalDebito(e.target.value)} placeholder="Banco / Conta" />
              </div>
              <div style={S.modalBotoes}>
                <button style={S.btnCancelar} onClick={() => setModalAberto(false)} disabled={salvando}>Cancelar</button>
                <button style={S.btnSalvar} onClick={salvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  layout:     { display: 'flex', minHeight: '100vh', backgroundColor: '#0B1120' },
  main:       { marginLeft: 240, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  titulo:     { color: '#E2C97E', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitulo:  { color: '#8B9BB4', fontSize: 14, margin: '4px 0 0 0' },
  headerAcoes:{ display: 'flex', alignItems: 'center', gap: 16 },
  toggleLabel:{ color: '#8B9BB4', fontSize: 13, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  btnNovo:    { backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  loading:    { color: '#8B9BB4', textAlign: 'center', padding: 60 },
  vazio:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 80, color: '#8B9BB4' },
  tabelaWrap: { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12, overflow: 'auto' },
  tabela:     { width: '100%', borderCollapse: 'collapse' },
  th:         { padding: '12px 16px', textAlign: 'left', color: '#8B9BB4', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #1E2A3A', whiteSpace: 'nowrap' },
  td:         { padding: '14px 16px', color: '#8B9BB4', fontSize: 13, borderBottom: '1px solid #1E2A3A10', verticalAlign: 'top' },
  btnAcao:    { padding: '4px 10px', borderRadius: 6, border: '1px solid #1E2A3A', backgroundColor: 'transparent', color: '#8B9BB4', fontSize: 11, cursor: 'pointer' },
  // Modal
  overlay:    { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:      { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 },
  modalHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitulo:{ color: '#E2C97E', fontSize: 18, fontWeight: 700, margin: 0 },
  btnFechar:  { background: 'none', border: 'none', color: '#8B9BB4', fontSize: 18, cursor: 'pointer' },
  form:       { display: 'flex', flexDirection: 'column', gap: 16 },
  linha2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grupo:      { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  label:      { color: '#8B9BB4', fontSize: 12, fontWeight: 500 },
  input:      { backgroundColor: '#0D1520', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '10px 12px', fontSize: 14 },
  modalBotoes:{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  btnCancelar:{ backgroundColor: 'transparent', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  btnSalvar:  { backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
