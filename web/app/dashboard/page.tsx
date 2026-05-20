'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { MetricCard } from '../../components/MetricCard'
import { GraficoBarras } from '../../components/GraficoBarras'
import { AlertaCard } from '../../components/AlertaCard'
import { Sidebar } from '../../components/Sidebar'
import { ChatIA } from '../../components/ChatIA'
import { formatCurrency } from '../../../theme'
import type { KpiDashboard } from '../../../types'

export default function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const [kpi,       setKpi]       = useState<KpiDashboard | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [erro,      setErro]      = useState<string | null>(null)
  const [insight,   setInsight]   = useState<string | null>(null)
  const [loadingIA, setLoadingIA] = useState(false)

  const mesAtual = new Date().toISOString().slice(0, 7)
  const [mes, setMes] = useState(mesAtual)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!token) return

    const carregar = async () => {
      setLoading(true)
      setErro(null)
      try {
        const result = await apiFetch<{ data: KpiDashboard }>(
          '/api/relatorios',
          { params: { mes } },
          token,
        )
        setKpi(result.data)
        // Busca insight da IA após carregar KPIs
        setInsight(null)
        setLoadingIA(true)
        apiFetch<{ data: { resposta: string } }>('/api/ia', {
          method: 'POST',
          body: JSON.stringify({ tipo: 'analise', mes, dados: result.data }),
        }, token).then(r => setInsight(r.data.resposta)).catch(() => {}).finally(() => setLoadingIA(false))
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    carregar()
  }, [token, mes])

  if (authLoading) return <Carregando />
  if (!user) return null

  return (
    <div style={styles.layout}>
      <Sidebar />

      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.titulo}>Dashboard Financeiro</h1>
            <p style={styles.subtitulo}>Visão consolidada do escritório</p>
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

        {loading ? (
          <Carregando />
        ) : kpi ? (
          <>
            {/* KPIs principais */}
            <div style={styles.kpiGrid}>
              <MetricCard
                titulo="Total do Mês"
                valor={formatCurrency(kpi.totalMes)}
                variacao={kpi.variacaoPercent}
                icone="💰"
              />
              <MetricCard
                titulo="Mês Anterior"
                valor={formatCurrency(kpi.totalMesAnterior)}
                subtitulo="base de comparação"
                icone="📅"
              />
              <MetricCard
                titulo="Pendente"
                valor={formatCurrency(kpi.totalPendente)}
                subtitulo={`${(100 - kpi.percentPago).toFixed(0)}% do total`}
                icone="⏳"
                cor="#E67E22"
              />
              <MetricCard
                titulo="Alertas"
                valor={String(kpi.alertasVencimento.length)}
                subtitulo="vencimentos em 7 dias"
                icone="🔔"
                cor={kpi.alertasVencimento.length > 0 ? '#C0392B' : '#27AE60'}
              />
            </div>

            {/* Card de Insight IA */}
            {(insight || loadingIA) && (
              <div style={styles.insightCard}>
                <div style={styles.insightHeader}>
                  <span style={styles.insightIcon}>🤖</span>
                  <span style={styles.insightTitulo}>Insight do Mês — IA</span>
                  {loadingIA && <span style={styles.insightSpinner}>Analisando...</span>}
                </div>
                {insight && <p style={styles.insightTexto}>{insight}</p>}
              </div>
            )}

            {/* Gráficos e tabelas */}
            <div style={styles.gridSecundario}>
              {/* Gastos por categoria */}
              <GraficoBarras
                dados={kpi.porCategoria}
                titulo="Gastos por Categoria"
              />

              {/* Top 5 e Unidades */}
              <div style={styles.colDireita}>
                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>Top 5 Maiores Despesas</h3>
                  <div style={styles.lista}>
                    {kpi.top5Despesas.map((d, i) => (
                      <div key={i} style={styles.listaItem}>
                        <div style={styles.listaItemInfo}>
                          <span style={styles.listaItemNum}>{i + 1}</span>
                          <div>
                            <div style={styles.listaItemDesc}>{d.descricao}</div>
                            <div style={styles.listaItemCat}>{d.categoria}</div>
                          </div>
                        </div>
                        <span style={styles.listaItemValor}>
                          {formatCurrency(d.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.card}>
                  <h3 style={styles.cardTitulo}>Por Unidade</h3>
                  <div style={styles.lista}>
                    {kpi.porUnidade.map((u, i) => (
                      <div key={i} style={styles.listaItemSimples}>
                        <span style={styles.listaItemDesc}>{u.nome}</span>
                        <span style={styles.listaItemValor}>
                          {formatCurrency(u.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas de vencimento */}
            {kpi.alertasVencimento.length > 0 && (
              <div style={styles.card}>
                <h3 style={styles.cardTitulo}>
                  Vencimentos Próximos ({kpi.alertasVencimento.length})
                </h3>
                <div style={styles.alertasGrid}>
                  {kpi.alertasVencimento.map(a => (
                    <AlertaCard key={a.id} alerta={a} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* Widget de chat flutuante */}
      {token && (
        <ChatIA token={token} mes={mes} kpiDados={kpi ?? undefined} />
      )}
    </div>
  )
}

function Carregando() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#8B9BB4', fontSize: 14 }}>Carregando...</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
  },
  main: {
    marginLeft: 240,
    flex:       1,
    padding:    32,
    display:    'flex',
    flexDirection: 'column',
    gap:        24,
  },
  header: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  titulo: {
    color:    '#E2C97E',
    fontSize: 24,
    fontWeight: 700,
    margin:   0,
  },
  subtitulo: {
    color:    '#8B9BB4',
    fontSize: 14,
    margin:   '4px 0 0 0',
  },
  inputMes: {
    backgroundColor: '#111827',
    border:          '1px solid #1E2A3A',
    color:           '#F2F0EA',
    borderRadius:    8,
    padding:         '8px 12px',
    fontSize:        14,
    cursor:          'pointer',
  },
  erro: {
    backgroundColor: '#3D1515',
    border:          '1px solid #C0392B',
    color:           '#E87070',
    borderRadius:    8,
    padding:         '12px 16px',
    fontSize:        14,
  },
  kpiGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap:                 16,
  },
  gridSecundario: {
    display:             'grid',
    gridTemplateColumns: '1fr 400px',
    gap:                 16,
    alignItems:          'start',
  },
  colDireita: {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius:    12,
    border:          '1px solid #1E2A3A',
    padding:         '20px 24px',
  },
  cardTitulo: {
    color:        '#E2C97E',
    fontSize:     15,
    fontWeight:   600,
    margin:       '0 0 16px 0',
  },
  lista: {
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
  },
  listaItem: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  listaItemSimples: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingBottom:  8,
    borderBottom:   '1px solid #1E2A3A',
  },
  listaItemInfo: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    flex:       1,
  },
  listaItemNum: {
    color:           '#7A6230',
    fontSize:        13,
    fontWeight:      700,
    width:           20,
    textAlign:       'center',
  },
  listaItemDesc: {
    color:    '#F2F0EA',
    fontSize: 13,
  },
  listaItemCat: {
    color:    '#8B9BB4',
    fontSize: 11,
  },
  listaItemValor: {
    color:      '#E2C97E',
    fontSize:   13,
    fontWeight: 600,
  },
  alertasGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap:                 8,
  },
  insightCard: {
    backgroundColor: '#0D1A2D',
    border:          '1px solid #2A4A70',
    borderRadius:    12,
    padding:         '16px 20px',
  },
  insightHeader: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    marginBottom: 10,
  },
  insightIcon:    { fontSize: 18 },
  insightTitulo:  { color: '#E2C97E', fontWeight: 700, fontSize: 14, flex: 1 },
  insightSpinner: { color: '#8B9BB4', fontSize: 12 },
  insightTexto:   { color: '#B8D4F0', fontSize: 14, lineHeight: 1.6, margin: 0 },
}
