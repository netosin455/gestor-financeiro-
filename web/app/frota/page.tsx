'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { ToastContainer, useToast } from '../../components/Toast'

interface Frota {
  id: string
  nome: string
  placa: string | null
  proprietario: string | null
  motorista_nome: string | null
  motorista_id: string | null
  active: boolean
  created_at: string
}

interface Motorista {
  id: string
  nome: string
  unidade_nome: string | null
}

export default function FrotaPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toasts, toast } = useToast()

  const [veiculos, setVeiculos]     = useState<Frota[]>([])
  const [motoristas, setMotoristas] = useState<Motorista[]>([])
  const [loading, setLoading]       = useState(true)
  const [mostrarInativos, setMostrarInativos] = useState(false)

  // Modal
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando]       = useState<Frota | null>(null)
  const [salvando, setSalvando]       = useState(false)

  // Form
  const [fNome, setFNome]             = useState('')
  const [fPlaca, setFPlaca]           = useState('')
  const [fProprietario, setFProprietario] = useState('')
  const [fMotorista, setFMotorista]   = useState('')

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [frotaRes, motorRes] = await Promise.all([
        apiFetch<{ data: Frota[] }>('/api/operacional', { params: { recurso: 'frota', active: mostrarInativos ? 'false' : 'true' } }, token),
        apiFetch<{ data: Motorista[] }>('/api/operacional', { params: { recurso: 'motoristas' } }, token),
      ])
      setVeiculos(frotaRes.data)
      setMotoristas(motorRes.data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar frota')
    } finally {
      setLoading(false)
    }
  }, [token, mostrarInativos])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setFNome(''); setFPlaca(''); setFProprietario(''); setFMotorista('')
    setModalAberto(true)
  }

  function abrirEditar(v: Frota) {
    setEditando(v)
    setFNome(v.nome)
    setFPlaca(v.placa ?? '')
    setFProprietario(v.proprietario ?? '')
    setFMotorista(v.motorista_id ?? '')
    setModalAberto(true)
  }

  async function salvar() {
    if (!fNome.trim()) return toast.error('Nome é obrigatório')
    setSalvando(true)
    try {
      const body = {
        nome: fNome.trim(),
        placa: fPlaca.trim() || null,
        proprietario: fProprietario.trim() || null,
        motorista_principal: fMotorista || null,
      }
      if (editando) {
        await apiFetch(`/api/operacional?recurso=frota&id=${editando.id}`, { method: 'PUT', body: JSON.stringify(body) }, token!)
        toast.success('Veículo atualizado!')
      } else {
        await apiFetch('/api/operacional?recurso=frota', { method: 'POST', body: JSON.stringify(body) }, token!)
        toast.success('Veículo cadastrado!')
      }
      setModalAberto(false)
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(v: Frota) {
    if (!isAdmin) return
    try {
      if (v.active) {
        await apiFetch(`/api/operacional?recurso=frota&id=${v.id}`, { method: 'DELETE' }, token!)
        toast.success(`${v.nome} desativado`)
      } else {
        await apiFetch(`/api/operacional?recurso=frota&id=${v.id}`, { method: 'PUT', body: JSON.stringify({ active: true }) }, token!)
        toast.success(`${v.nome} reativado`)
      }
      carregar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    }
  }

  if (authLoading || !user) return null

  return (
    <div style={S.layout}>
      <Sidebar />
      <ToastContainer toasts={toasts} />

      <main style={S.main}>
        <div style={S.pageHeader}>
          <div>
            <h1 style={S.titulo}>Frota</h1>
            <p style={S.subtitulo}>{veiculos.length} veículo{veiculos.length !== 1 ? 's' : ''}</p>
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
              <button style={S.btnNovo} onClick={abrirNovo}>+ Novo Veículo</button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={S.loading}>Carregando...</div>
        ) : veiculos.length === 0 ? (
          <div style={S.vazio}>
            <span style={{ fontSize: 40 }}>🚗</span>
            <span style={{ color: '#8B9BB4' }}>Nenhum veículo cadastrado</span>
          </div>
        ) : (
          <div style={S.grid}>
            {veiculos.map(v => (
              <div key={v.id} style={{ ...S.card, opacity: v.active ? 1 : 0.55 }}>
                <div style={S.cardTop}>
                  <div>
                    <span style={S.cardNome}>{v.nome}</span>
                    {v.placa && <span style={S.cardPlaca}>{v.placa}</span>}
                  </div>
                  <span style={{ ...S.badge, backgroundColor: v.active ? '#27AE6020' : '#C0392B20', color: v.active ? '#27AE60' : '#C0392B' }}>
                    {v.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div style={S.cardMeta}>
                  {v.proprietario && (
                    <div style={S.metaLinha}>
                      <span style={S.metaLabel}>Proprietário</span>
                      <span style={S.metaValor}>{v.proprietario}</span>
                    </div>
                  )}
                  {v.motorista_nome && (
                    <div style={S.metaLinha}>
                      <span style={S.metaLabel}>Motorista</span>
                      <span style={S.metaValor}>{v.motorista_nome}</span>
                    </div>
                  )}
                </div>

                {isAdmin && (
                  <div style={S.cardAcoes}>
                    <button style={S.btnEditar} onClick={() => abrirEditar(v)}>Editar</button>
                    <button
                      style={{ ...S.btnToggle, color: v.active ? '#C0392B' : '#27AE60' }}
                      onClick={() => toggleAtivo(v)}
                    >
                      {v.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalAberto && (
        <div style={S.overlay} onClick={() => setModalAberto(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitulo}>{editando ? 'Editar Veículo' : 'Novo Veículo'}</h2>
              <button style={S.btnFechar} onClick={() => setModalAberto(false)}>✕</button>
            </div>
            <div style={S.form}>
              <div style={S.grupo}>
                <label style={S.label}>Nome *</label>
                <input style={S.input} value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Ex: MOBI 01" />
              </div>
              <div style={S.grupo}>
                <label style={S.label}>Placa</label>
                <input style={S.input} value={fPlaca} onChange={e => setFPlaca(e.target.value)} placeholder="ABC-1234" />
              </div>
              <div style={S.grupo}>
                <label style={S.label}>Proprietário</label>
                <input style={S.input} value={fProprietario} onChange={e => setFProprietario(e.target.value)} placeholder="Nome do proprietário" />
              </div>
              <div style={S.grupo}>
                <label style={S.label}>Motorista Principal</label>
                <select style={S.input} value={fMotorista} onChange={e => setFMotorista(e.target.value)}>
                  <option value="">Não definido</option>
                  {motoristas.map(m => (
                    <option key={m.id} value={m.id}>{m.nome}{m.unidade_nome ? ` — ${m.unidade_nome}` : ''}</option>
                  ))}
                </select>
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
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:       { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardNome:   { color: '#F2F0EA', fontSize: 16, fontWeight: 700, display: 'block' },
  cardPlaca:  { color: '#E2C97E', fontSize: 12, fontWeight: 600, fontFamily: 'monospace', marginTop: 2, display: 'block' },
  badge:      { padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700 },
  cardMeta:   { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  metaLinha:  { display: 'flex', justifyContent: 'space-between' },
  metaLabel:  { color: '#8B9BB4', fontSize: 12 },
  metaValor:  { color: '#F2F0EA', fontSize: 12 },
  cardAcoes:  { display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #1E2A3A' },
  btnEditar:  { flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #1E2A3A', backgroundColor: 'transparent', color: '#8B9BB4', fontSize: 12, cursor: 'pointer' },
  btnToggle:  { flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid #1E2A3A', backgroundColor: 'transparent', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  // Modal
  overlay:    { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:      { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 14, width: '100%', maxWidth: 480, padding: 28 },
  modalHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitulo:{ color: '#E2C97E', fontSize: 18, fontWeight: 700, margin: 0 },
  btnFechar:  { background: 'none', border: 'none', color: '#8B9BB4', fontSize: 18, cursor: 'pointer' },
  form:       { display: 'flex', flexDirection: 'column', gap: 16 },
  grupo:      { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { color: '#8B9BB4', fontSize: 12, fontWeight: 500 },
  input:      { backgroundColor: '#0D1520', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '10px 12px', fontSize: 14 },
  modalBotoes:{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  btnCancelar:{ backgroundColor: 'transparent', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  btnSalvar:  { backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
