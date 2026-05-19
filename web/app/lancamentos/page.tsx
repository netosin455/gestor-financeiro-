'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { formatCurrency } from '../../../theme'

interface Lancamento {
  id: string
  descricao: string
  valor: number
  status: string
  status_calculado: string
  data_lancamento: string
  data_vencimento: string | null
  data_pagamento:  string | null
  mes_referencia:  string
  categoria_nome:  string
  categoria_cor:   string
  unidade_nome:    string | null
  setor:           string | null
  observacoes:     string | null
}

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
    ...( BADGE[status] ?? BADGE.cancelado ),
    borderRadius: 6,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return String(d).slice(0, 10).split('-').reverse().join('/')
}

export default function LancamentosPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes,    setMes]    = useState(mesAtual)
  const [status, setStatus] = useState('')
  const [page,   setPage]   = useState(1)

  const [dados,   setDados]   = useState<Resposta | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setErro(null)

    apiFetch<Resposta>(
      '/api/lancamentos',
      { params: { mes, status: status || undefined, page, limit: 50 } },
      token,
    )
      .then(setDados)
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false))
  }, [token, mes, status, page])

  if (authLoading) return <Spin />
  if (!user) return null

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        <div style={styles.header}>
          <div>
            <h1 style={styles.titulo}>Lançamentos</h1>
            <p style={styles.sub}>
              {dados ? `${dados.total} registros encontrados` : ''}
            </p>
          </div>
          <div style={styles.filtros}>
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
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        {loading ? <Spin /> : (
          <>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Data', 'Descrição', 'Categoria', 'Unidade', 'Vencimento', 'Valor', 'Status'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dados?.data.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#8B9BB4' }}>
                        Nenhum lançamento encontrado
                      </td>
                    </tr>
                  )}
                  {dados?.data.map(l => (
                    <tr key={l.id} style={styles.tr}>
                      <td style={styles.td}>{formatDate(l.data_lancamento)}</td>
                      <td style={{ ...styles.td, maxWidth: 240 }}>
                        <div style={{ color: '#F2F0EA', fontSize: 13 }}>{l.descricao}</div>
                        {l.observacoes && (
                          <div style={{ color: '#8B9BB4', fontSize: 11 }}>{l.observacoes}</div>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: l.categoria_cor || '#E2C97E', fontSize: 12 }}>
                          {l.categoria_nome}
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: '#8B9BB4' }}>
                        {l.unidade_nome ?? '—'}
                      </td>
                      <td style={{ ...styles.td, color: '#8B9BB4' }}>
                        {formatDate(l.data_vencimento)}
                      </td>
                      <td style={{ ...styles.td, color: '#E2C97E', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {formatCurrency(l.valor)}
                      </td>
                      <td style={styles.td}>
                        <span style={badgeStyle(l.status_calculado || l.status)}>
                          {(l.status_calculado || l.status).toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                  {page} / {dados.totalPages}
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
  filtros:   { display: 'flex', gap: 12, alignItems: 'center' },
  inputMes:  { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 14 },
  select:    { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 14 },
  erro:      { backgroundColor: '#3D1515', border: '1px solid #C0392B', color: '#E87070', borderRadius: 8, padding: '12px 16px', fontSize: 14 },
  tableWrap: { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', overflow: 'hidden' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { color: '#8B9BB4', fontSize: 12, fontWeight: 600, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #1E2A3A', backgroundColor: '#0D1520', whiteSpace: 'nowrap' },
  td:        { color: '#F2F0EA', fontSize: 13, padding: '12px 16px', borderBottom: '1px solid #0D1520', verticalAlign: 'top' },
  tr:        {},
  paginacao: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 },
  btnPag:    { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#8B9BB4', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' },
}
