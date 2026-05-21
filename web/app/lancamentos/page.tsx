'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { LancamentoModal } from '../../components/LancamentoModal'
import { ImportModal } from '../../components/ImportModal'
import { EmptyState } from '../../components/EmptyState'
import { useToast, ToastContainer } from '../../components/Toast'
import { formatCurrency } from '../../../theme'

interface Lancamento {
  id: string
  descricao: string
  valor: number
  tipo: string
  status: string
  status_calculado: string
  data_lancamento: string
  data_vencimento: string | null
  data_pagamento:  string | null
  mes_referencia:  string
  categoria_id:    string
  categoria_nome:  string
  categoria_cor:   string
  unidade_id:      string | null
  unidade_nome:    string | null
  setor:           string | null
  observacoes:     string | null
}

interface Categoria { id: string; nome: string; grupo: string; cor: string }

interface Resposta {
  data: Lancamento[]
  total: number
  page: number
  totalPages: number
}

const BADGE: Record<string, React.CSSProperties> = {
  pago:      { background: '#0D3320', color: '#27AE60', border: '1px solid #27AE60' },
  pendente:  { background: '#2D1F0A', color: '#E67E22', border: '1px solid #E67E22' },
  atrasado:  { background: '#3D1515', color: '#C0392B', border: '1px solid #C0392B' },
  vencendo:  { background: '#2D1F0A', color: '#E67E22', border: '1px solid #E67E22' },
  cancelado: { background: '#1a1a1a', color: '#8B9BB4', border: '1px solid #1E2A3A' },
}

function badgeStyle(status: string): React.CSSProperties {
  return {
    ...(BADGE[status] ?? BADGE.cancelado),
    borderRadius: 6, padding: '2px 8px',
    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  }
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return String(d).slice(0, 10).split('-').reverse().join('/')
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function LancamentosPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toasts, toast } = useToast()

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes,    setMes]    = useState(mesAtual)
  const [status, setStatus] = useState('')
  const [aba,    setAba]    = useState<'saida' | 'entrada'>('saida')
  const [page,   setPage]   = useState(1)

  const [dados,      setDados]      = useState<Resposta | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [categorias, setCategorias] = useState<Categoria[]>([])

  // Progresso de pagamentos (apenas saídas)
  const [progresso, setProgresso] = useState<{ total: number; pagas: number } | null>(null)

  // Bulk selection
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [bulkLoading,  setBulkLoading]  = useState(false)

  // Modais
  const [modalAberto,   setModalAberto]   = useState(false)
  const [importAberto,  setImportAberto]  = useState(false)
  const [editando,      setEditando]      = useState<Lancamento | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [pagandoId,     setPagandoId]     = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const [totais, setTotais] = useState({ entradas: 0, saidas: 0 })

  // Carrega totais de valor e progresso de pagamentos do mês em paralelo
  useEffect(() => {
    if (!token) return
    Promise.all([
      apiFetch<Resposta>('/api/lancamentos', { params: { mes, tipo: 'entrada', limit: 500 } }, token),
      apiFetch<Resposta>('/api/lancamentos', { params: { mes, tipo: 'saida',   limit: 500 } }, token),
      apiFetch<{ total: number }>('/api/lancamentos', { params: { mes, tipo: 'saida', status: 'pago', limit: 1 } }, token),
    ]).then(([e, s, pagos]) => {
      setTotais({
        entradas: (e.data ?? []).reduce((acc, l) => acc + Number(l.valor), 0),
        saidas:   (s.data ?? []).reduce((acc, l) => acc + Number(l.valor), 0),
      })
      setProgresso({ total: s.total ?? 0, pagas: pagos.total ?? 0 })
    }).catch(() => {})
  }, [token, mes]) // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = useCallback(() => {
    if (!token) return
    setLoading(true)
    setSelecionados(new Set())
    apiFetch<Resposta>(
      '/api/lancamentos',
      { params: { mes, tipo: aba, status: status || undefined, page, limit: 50 } },
      token,
    )
      .then(setDados)
      .catch(() => toast.error('Erro ao carregar lançamentos'))
      .finally(() => setLoading(false))
  }, [token, mes, aba, status, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return
    apiFetch<{ data: { categorias: Categoria[] } }>('/api/lancamentos', { params: { meta: '1' } }, token)
      .then(r => setCategorias(r.data.categorias))
      .catch(() => {})
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  const pagar = async (id: string) => {
    setPagandoId(id)
    try {
      await apiFetch(`/api/lancamentos/${id}`, {
        method: 'PUT',
        body:   JSON.stringify({ status: 'pago', pago: true, data_pagamento: hoje() }),
      }, token!)
      toast.success('Lançamento marcado como pago!')
      carregar()
    } catch {
      toast.error('Erro ao marcar como pago')
    } finally {
      setPagandoId(null)
    }
  }

  const excluir = async (id: string) => {
    try {
      await apiFetch(`/api/lancamentos/${id}`, { method: 'DELETE' }, token!)
      toast.success('Lançamento excluído')
      setConfirmDelete(null)
      carregar()
    } catch {
      toast.error('Erro ao excluir lançamento')
    }
  }

  // Bulk actions
  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodos = () => {
    const ids = dados?.data.map(l => l.id) ?? []
    if (selecionados.size === ids.length) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(ids))
    }
  }

  const executarBulk = async (acao: 'pagar' | 'cancelar') => {
    if (selecionados.size === 0) return
    setBulkLoading(true)
    try {
      await apiFetch('/api/lancamentos', {
        method: 'PATCH',
        body: JSON.stringify({ ids: Array.from(selecionados), acao }),
      }, token!)
      const label = acao === 'pagar' ? 'marcados como pagos' : 'cancelados'
      toast.success(`${selecionados.size} lançamento(s) ${label}!`)
      setSelecionados(new Set())
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar ação em lote')
    } finally {
      setBulkLoading(false)
    }
  }

  const exportarCsv = () => {
    const url = `/api/lancamentos?format=csv&mes=${mes}`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const u = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = u
        a.download = `lancamentos-${mes}.csv`
        a.click()
        URL.revokeObjectURL(u)
      })
      .catch(() => toast.error('Erro ao exportar CSV'))
  }

  const podeEditar  = user && ['super_admin', 'admin', 'financeiro'].includes(user.role)
  const podeExcluir = user && ['super_admin', 'admin'].includes(user.role)

  // Barra de progresso
  const pct = progresso && progresso.total > 0
    ? Math.round((progresso.pagas / progresso.total) * 100)
    : null

  const corProgresso = pct === null ? '#1E2A3A'
    : pct >= 80 ? '#27AE60'
    : pct >= 50 ? '#E67E22'
    : '#C0392B'

  const todosSelecionados = !!(dados?.data.length && selecionados.size === dados.data.length)
  const algunsSelecionados = selecionados.size > 0 && !todosSelecionados

  if (authLoading) return <Spin />
  if (!user) return null

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.titulo}>Lançamentos</h1>
            <p style={styles.sub}>{dados ? `${dados.total} registros` : ''}</p>
          </div>
          <div style={styles.acoesTopo}>
            {podeEditar && (
              <>
                <button onClick={() => setImportAberto(true)} style={styles.btnSecundario}>📥 Importar</button>
                <button onClick={exportarCsv} style={styles.btnSecundario}>📤 Exportar CSV</button>
                <button onClick={() => { setEditando(null); setModalAberto(true) }} style={styles.btnPrimario}>
                  + Novo Lançamento
                </button>
              </>
            )}
          </div>
        </div>

        {/* Cards de totais */}
        <div style={styles.cardsRow}>
          <div style={styles.cardEntrada}>
            <div style={styles.cardLabel}>💰 Total Entradas</div>
            <div style={styles.cardValorVerde}>{formatCurrency(totais.entradas)}</div>
          </div>
          <div style={styles.cardSaida}>
            <div style={styles.cardLabel}>💸 Total Saídas</div>
            <div style={styles.cardValorVermelho}>{formatCurrency(totais.saidas)}</div>
          </div>
          <div style={totais.entradas - totais.saidas >= 0 ? styles.cardSaldoPos : styles.cardSaldoNeg}>
            <div style={styles.cardLabel}>⚖️ Saldo do Mês</div>
            <div style={totais.entradas - totais.saidas >= 0 ? styles.cardValorVerde : styles.cardValorVermelho}>
              {formatCurrency(totais.entradas - totais.saidas)}
            </div>
          </div>
        </div>

        {/* Barra de progresso de pagamentos (apenas aba saídas) */}
        {aba === 'saida' && pct !== null && (
          <div style={{ backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ color: '#8B9BB4', fontSize: 12, fontWeight: 500 }}>
                Progresso de pagamentos
              </span>
              <span style={{ color: corProgresso, fontSize: 13, fontWeight: 700 }}>
                {progresso!.pagas}/{progresso!.total} pagas ({pct}%)
              </span>
            </div>
            <div style={{ height: 6, backgroundColor: '#1E2A3A', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                backgroundColor: corProgresso,
                width: `${pct}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}

        {/* Abas Saídas / Entradas */}
        <div style={styles.abas}>
          <button
            style={{ ...styles.aba, ...(aba === 'saida' ? abaAtiva('#C0392B') : {}) }}
            onClick={() => { setAba('saida'); setPage(1) }}
          >
            💸 Saídas
          </button>
          <button
            style={{ ...styles.aba, ...(aba === 'entrada' ? abaAtiva('#27AE60') : {}) }}
            onClick={() => { setAba('entrada'); setPage(1) }}
          >
            💰 Entradas
          </button>
        </div>

        {/* Filtros */}
        <div style={styles.filtrosBar}>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            style={styles.select}
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
            <option value="atrasado">Atrasado</option>
          </select>
          <input
            type="month"
            value={mes}
            max={mesAtual}
            onChange={e => { setMes(e.target.value); setPage(1) }}
            style={styles.inputMes}
          />
        </div>

        {/* Barra de Bulk Actions */}
        {selecionados.size > 0 && (
          <div style={{
            backgroundColor: '#1E2A3A', border: '1px solid #C9A84C',
            borderRadius: 10, padding: '10px 16px',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <span style={{ color: '#E2C97E', fontSize: 13, fontWeight: 600 }}>
              {selecionados.size} selecionado(s)
            </span>
            {aba === 'saida' && (
              <button
                onClick={() => executarBulk('pagar')}
                disabled={bulkLoading}
                style={{ backgroundColor: '#0D3320', border: '1px solid #27AE60', color: '#27AE60', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                ✅ Marcar como pago
              </button>
            )}
            <button
              onClick={() => executarBulk('cancelar')}
              disabled={bulkLoading}
              style={{ backgroundColor: '#2D1515', border: '1px solid #C0392B', color: '#C0392B', borderRadius: 7, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              🚫 Cancelar
            </button>
            <button
              onClick={() => setSelecionados(new Set())}
              style={{ background: 'none', border: 'none', color: '#8B9BB4', fontSize: 13, cursor: 'pointer', marginLeft: 'auto' }}
            >
              ✕ Limpar seleção
            </button>
          </div>
        )}

        {/* Tabela */}
        {loading ? <Spin /> : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {podeEditar && (
                      <th style={{ ...styles.th, width: 36, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={todosSelecionados}
                          ref={el => { if (el) el.indeterminate = algunsSelecionados }}
                          onChange={toggleTodos}
                          style={{ cursor: 'pointer', accentColor: '#C9A84C' }}
                        />
                      </th>
                    )}
                    <th style={styles.th}>Data</th>
                    <th style={styles.th}>Descrição</th>
                    <th style={styles.th}>Categoria</th>
                    <th style={styles.th}>Unidade</th>
                    <th style={styles.th}>Vencimento</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Valor</th>
                    <th style={styles.th}>Status</th>
                    {podeEditar && <th style={{ ...styles.th, textAlign: 'center' }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {(!dados?.data || dados.data.length === 0) ? (
                    <tr>
                      <td colSpan={podeEditar ? 9 : 7} style={{ padding: 0 }}>
                        <EmptyState
                          icone={aba === 'saida' ? '💸' : '💰'}
                          titulo={`Nenhuma ${aba === 'saida' ? 'saída' : 'entrada'} em ${mes}`}
                          descricao={status ? `Nenhum lançamento com status "${status}" neste período.` : 'Registre o primeiro lançamento deste mês.'}
                          acaoLabel={podeEditar ? `+ Nova ${aba === 'saida' ? 'Saída' : 'Entrada'}` : undefined}
                          onAcao={podeEditar ? () => { setEditando(null); setModalAberto(true) } : undefined}
                        />
                      </td>
                    </tr>
                  ) : (
                    dados.data.map(l => {
                      const st = l.status_calculado || l.status
                      const marcado = selecionados.has(l.id)
                      return (
                        <tr
                          key={l.id}
                          style={{ backgroundColor: marcado ? '#1A2A3A' : undefined, transition: 'background-color 0.1s' }}
                        >
                          {podeEditar && (
                            <td style={{ ...styles.td, textAlign: 'center', width: 36 }}>
                              <input
                                type="checkbox"
                                checked={marcado}
                                onChange={() => toggleSelecionado(l.id)}
                                style={{ cursor: 'pointer', accentColor: '#C9A84C' }}
                              />
                            </td>
                          )}
                          <td style={styles.td}>{fmtDate(l.data_lancamento)}</td>
                          <td style={{ ...styles.td, maxWidth: 220 }}>
                            <div style={{ color: '#F2F0EA', fontSize: 13 }}>{l.descricao}</div>
                            {l.observacoes && (
                              <div style={{ color: '#8B9BB4', fontSize: 11, marginTop: 2 }}>{l.observacoes}</div>
                            )}
                          </td>
                          <td style={styles.td}>
                            <span style={{ color: l.categoria_cor || '#E2C97E', fontSize: 12 }}>
                              {l.categoria_nome}
                            </span>
                          </td>
                          <td style={{ ...styles.td, color: '#8B9BB4', fontSize: 12 }}>
                            {l.unidade_nome ?? '—'}
                          </td>
                          <td style={{ ...styles.td, color: '#8B9BB4', fontSize: 12 }}>
                            {fmtDate(l.data_vencimento)}
                          </td>
                          <td style={{ ...styles.td, color: '#E2C97E', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {formatCurrency(l.valor)}
                          </td>
                          <td style={styles.td}>
                            <span style={badgeStyle(st)}>{st.toUpperCase()}</span>
                          </td>
                          {podeEditar && (
                            <td style={{ ...styles.td, textAlign: 'center' }}>
                              <div style={styles.acoesLinha}>
                                <button
                                  title="Editar"
                                  style={styles.btnAcao}
                                  onClick={() => { setEditando(l); setModalAberto(true) }}
                                >✏️</button>
                                {st !== 'pago' && st !== 'cancelado' && (
                                  <button
                                    title="Marcar como pago"
                                    style={styles.btnAcao}
                                    onClick={() => pagar(l.id)}
                                    disabled={pagandoId === l.id}
                                  >✅</button>
                                )}
                                {podeExcluir && (
                                  <button
                                    title="Excluir"
                                    style={styles.btnAcaoDanger}
                                    onClick={() => setConfirmDelete(l.id)}
                                  >🗑️</button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {dados && dados.totalPages > 1 && (
              <div style={styles.paginacao}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={styles.btnPag}
                >
                  ← Anterior
                </button>
                <span style={{ color: '#8B9BB4', fontSize: 13 }}>
                  Página {page} de {dados.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(dados.totalPages, p + 1))}
                  disabled={page === dados.totalPages}
                  style={styles.btnPag}
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal criar/editar */}
      <LancamentoModal
        isOpen={modalAberto}
        onClose={() => { setModalAberto(false); setEditando(null) }}
        onSuccess={msg => { toast.success(msg); carregar() }}
        onError={msg => toast.error(msg)}
        lancamento={editando}
        token={token ?? ''}
      />

      {/* Modal importar */}
      <ImportModal
        isOpen={importAberto}
        onClose={() => { setImportAberto(false); carregar() }}
        onSuccess={count => toast.success(`${count} lançamentos importados com sucesso!`)}
        onError={msg => toast.error(msg)}
        categorias={categorias}
        token={token ?? ''}
      />

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div style={styles.overlay} onClick={() => setConfirmDelete(null)}>
          <div style={styles.confirmBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 36, textAlign: 'center' }}>⚠️</div>
            <h3 style={{ color: '#E2C97E', textAlign: 'center', margin: '12px 0 8px' }}>
              Confirmar exclusão
            </h3>
            <p style={{ color: '#8B9BB4', fontSize: 14, textAlign: 'center', margin: '0 0 20px' }}>
              Esta ação não pode ser desfeita. O lançamento será cancelado e removido da listagem.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={styles.btnCancelarConf}>
                Cancelar
              </button>
              <button onClick={() => excluir(confirmDelete)} style={styles.btnConfirmarExcluir}>
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  )
}

function abaAtiva(cor: string): React.CSSProperties {
  return { backgroundColor: cor + '22', color: cor, borderBottom: `2px solid ${cor}` }
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
  main:      { marginLeft: 240, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 20 },
  header:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:    { color: '#E2C97E', fontSize: 24, fontWeight: 700, margin: 0 },
  sub:       { color: '#8B9BB4', fontSize: 14, margin: '4px 0 0' },
  acoesTopo: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  filtrosBar:{ display: 'flex', gap: 12 },
  inputMes:  { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 14 },
  select:    { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 14 },
  tableWrap: { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', overflow: 'hidden' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { color: '#8B9BB4', fontSize: 12, fontWeight: 600, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #1E2A3A', backgroundColor: '#0D1520', whiteSpace: 'nowrap' },
  td:        { color: '#F2F0EA', fontSize: 13, padding: '11px 16px', borderBottom: '1px solid #0D1520', verticalAlign: 'top' },
  paginacao: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 },
  btnPag:    { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' },
  btnPrimario: { backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A', borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  btnSecundario: { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  acoesLinha:  { display: 'flex', gap: 4, justifyContent: 'center' },
  btnAcao:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '3px 5px', borderRadius: 6 },
  btnAcaoDanger: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '3px 5px', borderRadius: 6 },
  overlay:   { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  confirmBox: { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 14, padding: 32, maxWidth: 400, width: '100%' },
  btnCancelarConf:    { backgroundColor: 'transparent', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' },
  btnConfirmarExcluir: { backgroundColor: '#C0392B', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  cardsRow:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  cardEntrada:    { backgroundColor: '#0D2018', border: '1px solid #27AE60', borderRadius: 12, padding: '16px 20px' },
  cardSaida:      { backgroundColor: '#2D1515', border: '1px solid #C0392B', borderRadius: 12, padding: '16px 20px' },
  cardSaldoPos:   { backgroundColor: '#0D2018', border: '1px solid #27AE60', borderRadius: 12, padding: '16px 20px' },
  cardSaldoNeg:   { backgroundColor: '#2D1515', border: '1px solid #C0392B', borderRadius: 12, padding: '16px 20px' },
  cardLabel:      { color: '#8B9BB4', fontSize: 12, fontWeight: 500, marginBottom: 6 },
  cardValorVerde: { color: '#27AE60', fontSize: 20, fontWeight: 700 },
  cardValorVermelho: { color: '#C0392B', fontSize: 20, fontWeight: 700 },
  abas:           { display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #1E2A3A', width: 'fit-content' },
  aba:            { padding: '9px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: '#111827', color: '#8B9BB4', transition: 'all 0.15s' },
}
