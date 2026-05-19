'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { formatCurrency } from '../../../theme'

interface CategoriaRelatorio {
  id: string
  nome: string
  grupo: string
  cor: string
  valor: number
  qtd: number
  valorMesAnterior: number
  variacaoPercent: number | null
}

interface RelatorioMensal {
  mes: string
  mesAnterior: string
  totalMes: number
  totalMesAnterior: number
  variacaoPercent: number | null
  categorias: CategoriaRelatorio[]
}

function variacaoBadge(v: number | null) {
  if (v === null) return <span style={{ color: '#8B9BB4', fontSize: 11 }}>—</span>
  const cor  = v > 0 ? '#C0392B' : v < 0 ? '#27AE60' : '#8B9BB4'
  const sinal = v > 0 ? '▲' : v < 0 ? '▼' : '●'
  return (
    <span style={{ color: cor, fontSize: 12, fontWeight: 600 }}>
      {sinal} {Math.abs(v).toFixed(1)}%
    </span>
  )
}

function mesLabel(mes: string) {
  const [ano, m] = mes.split('-')
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${nomes[Number(m) - 1]}/${ano}`
}

export default function RelatoriosPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes,     setMes]     = useState(mesAtual)
  const [dados,   setDados]   = useState<RelatorioMensal | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setErro(null)

    apiFetch<{ data: RelatorioMensal }>(
      '/api/relatorios/mensal',
      { params: { mes } },
      token,
    )
      .then(r => setDados(r.data))
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false))
  }, [token, mes])

  if (authLoading) return <Spin />
  if (!user) return null

  const categoriasFiltradas = dados?.categorias.filter(c => c.valor > 0) ?? []

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        <div style={styles.header}>
          <div>
            <h1 style={styles.titulo}>Relatório Mensal</h1>
            <p style={styles.sub}>Comparativo por categoria</p>
          </div>
          <input
            type="month"
            value={mes}
            max={mesAtual}
            onChange={e => setMes(e.target.value)}
            style={styles.inputMes}
          />
        </div>

        {erro && <div style={styles.erro}>{erro}</div>}

        {loading ? <Spin /> : dados ? (
          <>
            {/* Totais */}
            <div style={styles.totaisGrid}>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Total {mesLabel(dados.mes)}</div>
                <div style={styles.cardValor}>{formatCurrency(dados.totalMes)}</div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Total {mesLabel(dados.mesAnterior)}</div>
                <div style={{ ...styles.cardValor, color: '#8B9BB4' }}>
                  {formatCurrency(dados.totalMesAnterior)}
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Variação</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
                  {variacaoBadge(dados.variacaoPercent)}
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Categorias ativas</div>
                <div style={styles.cardValor}>{categoriasFiltradas.length}</div>
              </div>
            </div>

            {/* Tabela por categoria */}
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Categoria</th>
                    <th style={styles.th}>Grupo</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Qtd</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{mesLabel(dados.mes)}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>{mesLabel(dados.mesAnterior)}</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Variação</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {categoriasFiltradas.map(c => (
                    <tr key={c.id}>
                      <td style={styles.td}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: c.cor || '#E2C97E', marginRight: 8 }} />
                        <span style={{ color: '#F2F0EA', fontSize: 13 }}>{c.nome}</span>
                      </td>
                      <td style={{ ...styles.td, color: '#8B9BB4', fontSize: 12, textTransform: 'capitalize' }}>
                        {c.grupo || '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#8B9BB4' }}>{c.qtd}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#E2C97E', fontWeight: 600 }}>
                        {formatCurrency(c.valor)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#8B9BB4' }}>
                        {c.valorMesAnterior > 0 ? formatCurrency(c.valorMesAnterior) : '—'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {variacaoBadge(c.variacaoPercent)}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#8B9BB4', fontSize: 12 }}>
                        {dados.totalMes > 0 ? ((c.valor / dados.totalMes) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ ...styles.td, color: '#E2C97E', fontWeight: 700 }}>TOTAL</td>
                    <td style={{ ...styles.td, textAlign: 'right', color: '#E2C97E', fontWeight: 700 }}>
                      {formatCurrency(dados.totalMes)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: '#8B9BB4', fontWeight: 600 }}>
                      {formatCurrency(dados.totalMesAnterior)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {variacaoBadge(dados.variacaoPercent)}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: '#E2C97E', fontWeight: 700 }}>100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : null}
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
  layout:     { display: 'flex', minHeight: '100vh' },
  main:       { marginLeft: 240, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:     { color: '#E2C97E', fontSize: 24, fontWeight: 700, margin: 0 },
  sub:        { color: '#8B9BB4', fontSize: 14, margin: '4px 0 0' },
  inputMes:   { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 14 },
  erro:       { backgroundColor: '#3D1515', border: '1px solid #C0392B', color: '#E87070', borderRadius: 8, padding: '12px 16px', fontSize: 14 },
  totaisGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  card:       { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', padding: '20px 24px' },
  cardLabel:  { color: '#8B9BB4', fontSize: 12, fontWeight: 500 },
  cardValor:  { color: '#E2C97E', fontSize: 22, fontWeight: 700, marginTop: 4 },
  tableWrap:  { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { color: '#8B9BB4', fontSize: 12, fontWeight: 600, textAlign: 'left', padding: '12px 16px', borderBottom: '1px solid #1E2A3A', backgroundColor: '#0D1520', whiteSpace: 'nowrap' },
  td:         { color: '#F2F0EA', fontSize: 13, padding: '12px 16px', borderBottom: '1px solid #0D1520' },
}
