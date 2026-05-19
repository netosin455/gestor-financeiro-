'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { useToast, ToastContainer } from '../../components/Toast'

interface Usuario {
  id:           string
  name:         string
  email:        string
  role:         string
  unidade:      string | null
  unidade_nome: string | null
  active:       boolean
  created_at:   string
}

interface FormCriar {
  name:     string
  email:    string
  password: string
  role:     string
  unidade:  string
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin:       'Administrador',
  financeiro:  'Coord. Financeiro',
  gestor:      'Gestor de Unidade',
}

const ROLE_CORES: Record<string, { bg: string; color: string; border: string }> = {
  super_admin: { bg: '#1A0A30', color: '#9B59B6', border: '#9B59B6' },
  admin:       { bg: '#0D1A2D', color: '#2980B9', border: '#2980B9' },
  financeiro:  { bg: '#0D3320', color: '#27AE60', border: '#27AE60' },
  gestor:      { bg: '#2D1F0A', color: '#E67E22', border: '#E67E22' },
}

function roleBadge(role: string): React.CSSProperties {
  const c = ROLE_CORES[role] ?? { bg: '#1a1a1a', color: '#8B9BB4', border: '#1E2A3A' }
  return {
    backgroundColor: c.bg, color: c.color,
    border: `1px solid ${c.border}`,
    borderRadius: 6, padding: '2px 8px',
    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  }
}

const FORM_VAZIO: FormCriar = { name: '', email: '', password: '', role: 'financeiro', unidade: '' }

export default function UsuariosPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toasts, toast } = useToast()

  const [usuarios,  setUsuarios]  = useState<Usuario[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState<FormCriar>(FORM_VAZIO)
  const [salvando,  setSalvando]  = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
    if (!authLoading && user && !['super_admin', 'admin'].includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [authLoading, user, router])

  const carregar = useCallback(() => {
    if (!token) return
    setLoading(true)
    apiFetch<{ data: Usuario[] }>('/api/usuarios', {}, token)
      .then(r => setUsuarios(r.data))
      .catch(() => toast.error('Erro ao carregar usuários'))
      .finally(() => setLoading(false))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar() }, [carregar])

  const abrirCriar = () => {
    setEditId(null)
    setForm(FORM_VAZIO)
    setModalOpen(true)
  }

  const abrirEditar = (u: Usuario) => {
    setEditId(u.id)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, unidade: u.unidade ?? '' })
    setModalOpen(true)
  }

  const toggleAtivo = async (u: Usuario) => {
    try {
      await apiFetch(`/api/usuarios?id=${u.id}`, {
        method: 'PUT',
        body:   JSON.stringify({ active: !u.active }),
      }, token!)
      toast.success(u.active ? 'Usuário desativado' : 'Usuário reativado')
      carregar()
    } catch {
      toast.error('Erro ao atualizar status')
    }
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim())  return toast.error('Nome é obrigatório')
    if (!form.email.trim()) return toast.error('Email é obrigatório')
    if (!editId && !form.password) return toast.error('Senha é obrigatória para novo usuário')

    setSalvando(true)
    try {
      const body: Record<string, unknown> = {
        name:    form.name.trim(),
        email:   form.email.trim(),
        role:    form.role,
        unidade: form.unidade || null,
      }
      if (form.password) body.password = form.password

      if (editId) {
        await apiFetch(`/api/usuarios?id=${editId}`, {
          method: 'PUT',
          body:   JSON.stringify(body),
        }, token!)
        toast.success('Usuário atualizado!')
      } else {
        await apiFetch('/api/usuarios', {
          method: 'POST',
          body:   JSON.stringify(body),
        }, token!)
        toast.success('Usuário criado! Ele já pode fazer login.')
      }
      setModalOpen(false)
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (authLoading) return <Spin />
  if (!user || !['super_admin', 'admin'].includes(user.role)) return null

  const isSuperAdmin = user.role === 'super_admin'

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        <div style={styles.header}>
          <div>
            <h1 style={styles.titulo}>Usuários do Sistema</h1>
            <p style={styles.sub}>Gerencie quem tem acesso e qual papel cada um desempenha</p>
          </div>
          <button onClick={abrirCriar} style={styles.btnPrimario}>
            + Novo Usuário
          </button>
        </div>

        {/* Card explicativo de papéis */}
        <div style={styles.infoCard}>
          <h3 style={styles.infoTitulo}>Papéis e Permissões</h3>
          <div style={styles.roleGrid}>
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <div key={role} style={styles.roleItem}>
                <span style={roleBadge(role)}>{label}</span>
                <span style={styles.roleDesc}>
                  {role === 'super_admin' && 'Acesso total, configura sistema'}
                  {role === 'admin'       && 'Gerencia usuários e lançamentos'}
                  {role === 'financeiro'  && 'Cria e edita lançamentos de todas as unidades'}
                  {role === 'gestor'      && 'Lança apenas na própria unidade'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela de usuários */}
        {loading ? <Spin /> : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Nome</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Papel</th>
                  <th style={styles.th}>Unidade</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td style={styles.td}>
                      <div style={{ color: '#F2F0EA', fontWeight: 500 }}>{u.name}</div>
                      {u.id === user.id && (
                        <div style={{ color: '#8B9BB4', fontSize: 11 }}>você</div>
                      )}
                    </td>
                    <td style={{ ...styles.td, color: '#8B9BB4', fontSize: 12 }}>{u.email}</td>
                    <td style={styles.td}>
                      <span style={roleBadge(u.role)}>{ROLE_LABELS[u.role] ?? u.role}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#8B9BB4', fontSize: 12 }}>
                      {u.unidade_nome ?? u.unidade ?? '—'}
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...roleBadge(u.active ? 'financeiro' : 'gestor'),
                        backgroundColor: u.active ? '#0D3320' : '#1a1a1a',
                        color:           u.active ? '#27AE60'  : '#8B9BB4',
                        borderColor:     u.active ? '#27AE60'  : '#1E2A3A',
                      }}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          onClick={() => abrirEditar(u)}
                          style={styles.btnAcao}
                          title="Editar"
                          disabled={u.role === 'super_admin' && !isSuperAdmin}
                        >
                          ✏️
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => toggleAtivo(u)}
                            style={styles.btnAcao}
                            title={u.active ? 'Desativar acesso' : 'Reativar acesso'}
                            disabled={u.role === 'super_admin' && !isSuperAdmin}
                          >
                            {u.active ? '🔒' : '🔓'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal criar/editar */}
      {modalOpen && (
        <div style={styles.overlay} onClick={() => setModalOpen(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitulo}>
                {editId ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={styles.btnFechar}>✕</button>
            </div>

            <form onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={styles.grupo}>
                <label style={styles.label}>Nome completo *</label>
                <input style={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Maria Silva" required />
              </div>

              <div style={styles.grupo}>
                <label style={styles.label}>Email *</label>
                <input style={styles.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="maria@araujoprev.com.br" required disabled={!!editId} />
                {editId && <span style={{ color: '#8B9BB4', fontSize: 11 }}>Email não pode ser alterado</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={styles.grupo}>
                  <label style={styles.label}>Papel *</label>
                  <select style={styles.input} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                    <option value="admin">Administrador</option>
                    <option value="financeiro">Coord. Financeiro</option>
                    <option value="gestor">Gestor de Unidade</option>
                  </select>
                </div>
                <div style={styles.grupo}>
                  <label style={styles.label}>Unidade (opcional)</label>
                  <input style={styles.input} value={form.unidade} onChange={e => setForm(f => ({ ...f, unidade: e.target.value }))} placeholder="Nome da unidade" />
                </div>
              </div>

              <div style={styles.grupo}>
                <label style={styles.label}>
                  {editId ? 'Nova senha (deixe em branco para não alterar)' : 'Senha inicial *'}
                </label>
                <input
                  style={styles.input}
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  required={!editId}
                />
              </div>

              {form.role === 'financeiro' && (
                <div style={styles.dica}>
                  💡 O Coordenador Financeiro poderá criar, editar e marcar como pago lançamentos de todas as unidades.
                </div>
              )}
              {form.role === 'gestor' && (
                <div style={styles.dica}>
                  💡 O Gestor só poderá criar lançamentos para a unidade definida acima.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setModalOpen(false)} style={styles.btnCancelar} disabled={salvando}>
                  Cancelar
                </button>
                <button type="submit" style={styles.btnSalvar} disabled={salvando}>
                  {salvando ? 'Salvando...' : editId ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}

function Spin() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#8B9BB4', fontSize: 14 }}>Carregando...</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout:    { display: 'flex', minHeight: '100vh' },
  main:      { marginLeft: 240, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:    { color: '#E2C97E', fontSize: 24, fontWeight: 700, margin: 0 },
  sub:       { color: '#8B9BB4', fontSize: 14, margin: '4px 0 0' },
  btnPrimario: { backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  infoCard:  { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12, padding: '20px 24px' },
  infoTitulo:{ color: '#E2C97E', fontSize: 14, fontWeight: 600, margin: '0 0 14px' },
  roleGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 },
  roleItem:  { display: 'flex', flexDirection: 'column', gap: 4 },
  roleDesc:  { color: '#8B9BB4', fontSize: 12 },
  tableWrap: { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', overflow: 'hidden' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { color: '#8B9BB4', fontSize: 12, fontWeight: 600, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #1E2A3A', backgroundColor: '#0D1520', whiteSpace: 'nowrap' },
  td:        { color: '#F2F0EA', fontSize: 13, padding: '12px 16px', borderBottom: '1px solid #0D1520', verticalAlign: 'middle' },
  btnAcao:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '3px 6px', borderRadius: 6 },
  overlay:   { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:     { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 14, width: '100%', maxWidth: 560, padding: 28 },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitulo: { color: '#E2C97E', fontSize: 18, fontWeight: 700, margin: 0 },
  btnFechar: { background: 'none', border: 'none', color: '#8B9BB4', fontSize: 18, cursor: 'pointer' },
  grupo:     { display: 'flex', flexDirection: 'column', gap: 6 },
  label:     { color: '#8B9BB4', fontSize: 12, fontWeight: 500 },
  input:     { backgroundColor: '#0D1520', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', width: '100%' },
  dica:      { backgroundColor: '#0D1A2D', border: '1px solid #1E2A3A', borderRadius: 8, padding: '10px 14px', color: '#8B9BB4', fontSize: 13 },
  btnCancelar:{ backgroundColor: 'transparent', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  btnSalvar: { backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
}
