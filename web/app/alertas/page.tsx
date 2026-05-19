'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { formatCurrency } from '../../../theme'
import type { KpiDashboard } from '../../../types'

function formatDate(d: string): string {
  return String(d).slice(0, 10).split('-').reverse().join('/')
}

function diasLabel(dias: number): string {
  if (dias === 0) return 'Vence hoje'
  if (dias === 1) return 'Vence amanhã'
  return `${dias} dias`
}

function diasCor(dias: number): string {
  if (dias === 0) return '#C0392B'
  if (dias <= 2)  return '#E67E22'
  return '#E2C97E'
}

export default function AlertasPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes,     setMes]     = useState(mesAtual)
  const [kpi,     setKpi]     = useState<KpiDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro,    setErro]    = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setErro(null)

    apiFetch<{ data: KpiDashboard }>(
      '/api/relatorios/dashboard',
      { params: { mes } },
      token,
    )
      .then(r => setKpi(r.data))
      .catch(e => setErro(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false))
  }, [token, mes])

  if (authLoading) return <Spin />
  if (!user) return null

  const alertas   = kpi?.alertasVencimento ?? []
  const pendentes = (kpi?.totalPendente ?? 0)

  return (
    <div style={styles.layout}>
      <Sidebar />
      <main style={styles.main}>

        <div style={styles.header}>
          <div>
            <h1 style={styles.titulo}>Alertas</h1>
            <p style={styles.sub}>Vencimentos próximos e pendências</p>
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

        {loading ? <Spin /> : (
          <>
            {/* Resumo */}
            <div style={styles.resumoGrid}>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Vencimentos nos próximos 7 dias</div>
                <div style={{ ...styles.cardValor, color: alertas.length > 0 ? '#C0392B' : '#27AE60' }}>
                  {alertas.length}
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>Total pendente no mês</div>
                <div style={{ ...styles.cardValor, color: '#E67E22' }}>
                  {formatCurrency(pendentes)}
                </div>
              </div>
              <div style={styles.card}>
                <div style={styles.cardLabel}>% pago no mês</div>
                <div style={{ ...styles.cardValor, color: '#27AE60' }}>
                  {kpi ? kpi.percentPago.toFixed(0) + '%' : '—'}
                </div>
              </div>
            </div>

            {/* Lista de alertas */}
            {alertas.length === 0 ? (
              <div style={styles.vazio}>
                <div style={{ fontSize: 40 }}>✅</div>
                <div style={{ color: '#27AE60', fontSize: 16, fontWeight: 600, marginTop: 12 }}>
                  Nenhum vencimento nos próximos 7 dias
                </div>
                <div style={{ color: '#8B9BB4', fontSize: 13, marginTop: 4 }}>
                  Tudo em dia para o período selecionado
                </div>
              </div>
            ) : (
              <div style={styles.section}>
                <h2 style={styles.sectionTitulo}>
                  Vencimentos Próximos — {alertas.length} item{alertas.length !== 1 ? 's' : ''}
                </h2>
                <div style={styles.alertaLista}>
                  {alertas.map(a => (
                    <div key={a.id} style={styles.alertaCard}>
                      <div style={styles.alertaEsq}>
                        <div style={{ color: '#F2F0EA', fontSize: 14, fontWeight: 500 }}>
                          {a.descricao}
                        </div>
                        <div style={{ color: '#8B9BB4', fontSize: 12, marginTop: 2 }}>
                          {a.categoria} · vence {formatDate(a.data_vencimento)}
                        </div>
                      </div>
                      <div style={styles.alertaDir}>
                        <div style={{ color: '#E2C97E', fontSize: 15, fontWeight: 700 }}>
                          {formatCurrency(a.valor)}
                        </div>
                        <div style={{
                          color: diasCor(a.dias_restantes),
                          fontSize: 12,
                          fontWeight: 600,
                          marginTop: 2,
                        }}>
                          {diasLabel(a.dias_restantes)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
  layout:      { display: 'flex', minHeight: '100vh' },
  main:        { marginLeft: 240, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:      { color: '#E2C97E', fontSize: 24, fontWeight: 700, margin: 0 },
  sub:         { color: '#8B9BB4', fontSize: 14, margin: '4px 0 0' },
  inputMes:    { backgroundColor: '#111827', border: '1px solid #1E2A3A', color: '#F2F0EA', borderRadius: 8, padding: '8px 12px', fontSize: 14 },
  erro:        { backgroundColor: '#3D1515', border: '1px solid #C0392B', color: '#E87070', borderRadius: 8, padding: '12px 16px', fontSize: 14 },
  resumoGrid:  { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 },
  card:        { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', padding: '20px 24px' },
  cardLabel:   { color: '#8B9BB4', fontSize: 12, fontWeight: 500 },
  cardValor:   { color: '#E2C97E', fontSize: 28, fontWeight: 700, marginTop: 4 },
  vazio:       { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', padding: 48, textAlign: 'center' },
  section:     { backgroundColor: '#111827', borderRadius: 12, border: '1px solid #1E2A3A', padding: '20px 24px' },
  sectionTitulo: { color: '#E2C97E', fontSize: 15, fontWeight: 600, margin: '0 0 16px' },
  alertaLista: { display: 'flex', flexDirection: 'column', gap: 8 },
  alertaCard:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D1520', borderRadius: 8, padding: '14px 16px', border: '1px solid #1E2A3A' },
  alertaEsq:   { flex: 1 },
  alertaDir:   { textAlign: 'right', flexShrink: 0 },
}
