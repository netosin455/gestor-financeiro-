'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'
import { apiFetch } from '../../services/api'
import { Sidebar } from '../../components/Sidebar'
import { formatCurrency } from '../../../theme'

// ── Constantes ────────────────────────────────────────────────────
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const STATUS_COR: Record<string, string> = {
  pago:     '#27AE60',
  pendente: '#E67E22',
  atrasado: '#C0392B',
}

// ── Tipos ─────────────────────────────────────────────────────────
interface Lancamento {
  id: string
  descricao: string
  valor: number
  status: string
  pago: boolean
  data_vencimento: string | null
  data_pagamento: string | null
  categoria: string
  categoria_cor: string
}

// ── Helpers ───────────────────────────────────────────────────────
function buildCalendar(year: number, month: number): (string | null)[][] {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks: (string | null)[][] = []
  let week: (string | null)[] = Array(firstDay).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    week.push(iso)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDia(iso: string): string {
  const [, , d] = iso.split('-')
  return String(Number(d))
}

function formatDataBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

// ── Componente principal ──────────────────────────────────────────
export default function CalendarioPage() {
  const { user, token, loading: authLoading } = useAuth()
  const router = useRouter()

  const [year,     setYear]     = useState(new Date().getFullYear())
  const [month,    setMonth]    = useState(new Date().getMonth())
  const [selected, setSelected] = useState(today())
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState<string | null>(null)

  const mesKey = `${year}-${String(month + 1).padStart(2, '0')}`

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setErro(null)
    try {
      const res = await apiFetch<{ data: Lancamento[] }>(
        '/api/alertas',
        { params: { modo: 'calendario', mes: mesKey } },
        token,
      )
      setLancamentos(res.data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar calendário')
    } finally {
      setLoading(false)
    }
  }, [token, mesKey])

  useEffect(() => { carregar() }, [carregar])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  // Agrupa por data: cada lancamento aparece na data_vencimento E/OU data_pagamento
  const porData = useMemo(() => {
    const map: Record<string, Lancamento[]> = {}
    for (const l of lancamentos) {
      const datas = new Set<string>()
      if (l.data_vencimento) datas.add(l.data_vencimento.slice(0, 10))
      if (l.data_pagamento)  datas.add(l.data_pagamento.slice(0, 10))
      for (const d of datas) {
        if (!map[d]) map[d] = []
        // evita duplicatas
        if (!map[d].find(x => x.id === l.id)) map[d].push(l)
      }
    }
    return map
  }, [lancamentos])

  const selectedLancamentos = porData[selected] ?? []
  const weeks = buildCalendar(year, month)

  // Resumo do mês
  const totalMes     = lancamentos.reduce((s, l) => s + Number(l.valor), 0)
  const totalPago    = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0)
  const totalPendente = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0)
  const totalAtrasado = lancamentos.filter(l => l.status === 'atrasado').reduce((s, l) => s + Number(l.valor), 0)

  if (authLoading) return null
  if (!user) return null

  return (
    <div style={S.layout}>
      <Sidebar />

      <main style={S.main}>
        {/* Cabeçalho */}
        <div style={S.pageHeader}>
          <div>
            <h1 style={S.titulo}>Calendário Financeiro</h1>
            <p style={S.subtitulo}>Vencimentos e pagamentos por dia</p>
          </div>
        </div>

        {/* Resumo do mês */}
        <div style={S.resumoGrid}>
          <div style={S.resumoCard}>
            <span style={S.resumoLabel}>Total do Mês</span>
            <span style={S.resumoValor}>{formatCurrency(totalMes)}</span>
          </div>
          <div style={S.resumoCard}>
            <span style={S.resumoLabel}>Pago</span>
            <span style={{ ...S.resumoValor, color: '#27AE60' }}>{formatCurrency(totalPago)}</span>
          </div>
          <div style={S.resumoCard}>
            <span style={S.resumoLabel}>Pendente</span>
            <span style={{ ...S.resumoValor, color: '#E67E22' }}>{formatCurrency(totalPendente)}</span>
          </div>
          <div style={S.resumoCard}>
            <span style={S.resumoLabel}>Atrasado</span>
            <span style={{ ...S.resumoValor, color: '#C0392B' }}>{formatCurrency(totalAtrasado)}</span>
          </div>
        </div>

        <div style={S.corpo}>
          {/* ── Calendário ── */}
          <div style={S.calCard}>
            {/* Navegação do mês */}
            <div style={S.calHeader}>
              <button style={S.navBtn} onClick={prevMonth}>‹</button>
              <div style={S.mesWrap}>
                <span style={S.mesTitulo}>{MONTH_NAMES[month]}</span>
                <span style={S.mesAno}>{year}</span>
              </div>
              <button style={S.navBtn} onClick={nextMonth}>›</button>
            </div>

            {/* Dias da semana */}
            <div style={S.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <div key={i} style={{
                  ...S.weekDay,
                  ...(i === 0 || i === 6 ? S.weekDayFim : {}),
                }}>{d}</div>
              ))}
            </div>

            {/* Grid dos dias */}
            {loading ? (
              <div style={S.loadingBox}>Carregando...</div>
            ) : (
              <div style={S.grid}>
                {weeks.map((week, wi) => (
                  <div key={wi} style={S.weekRow}>
                    {week.map((dateStr, di) => {
                      if (!dateStr) return <div key={di} style={S.dayCell} />
                      const isToday    = dateStr === today()
                      const isSelected = dateStr === selected
                      const items      = porData[dateStr] ?? []
                      const statusDots = [...new Set(items.map(l => l.status))].slice(0, 3)
                      return (
                        <button
                          key={di}
                          style={{
                            ...S.dayCell,
                            ...(isSelected ? S.dayCellSelected : {}),
                            ...(isToday && !isSelected ? S.dayCellToday : {}),
                          }}
                          onClick={() => setSelected(dateStr)}
                        >
                          <span style={{
                            ...S.dayText,
                            ...(isSelected ? S.dayTextSelected : {}),
                            ...(isToday && !isSelected ? S.dayTextToday : {}),
                          }}>
                            {formatDia(dateStr)}
                          </span>
                          {statusDots.length > 0 && (
                            <div style={S.dotsRow}>
                              {statusDots.map((s, idx) => (
                                <div key={idx} style={{ ...S.dot, backgroundColor: STATUS_COR[s] ?? '#8B9BB4' }} />
                              ))}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Lista do dia selecionado ── */}
          <div style={S.listaCard}>
            <div style={S.listaHeader}>
              <span style={S.listaTitulo}>
                {selected === today()
                  ? 'Hoje'
                  : formatDataBR(selected)}
              </span>
              <span style={S.listaCount}>
                {selectedLancamentos.length} lançamento{selectedLancamentos.length !== 1 ? 's' : ''}
              </span>
            </div>

            {erro && (
              <div style={S.erroBox}>{erro}</div>
            )}

            {selectedLancamentos.length === 0 ? (
              <div style={S.vazio}>
                <span style={S.vazioIcone}>📅</span>
                <span style={S.vazioTexto}>Nenhum lançamento neste dia</span>
              </div>
            ) : (
              <div style={S.lancamentosList}>
                {selectedLancamentos
                  .sort((a, b) => Number(b.valor) - Number(a.valor))
                  .map(l => {
                    const isVencimento = l.data_vencimento?.slice(0, 10) === selected
                    const isPagamento  = l.data_pagamento?.slice(0, 10) === selected
                    return (
                      <div key={l.id + selected} style={S.lancRow}>
                        <div style={{ ...S.lancBarra, backgroundColor: STATUS_COR[l.status] ?? '#8B9BB4' }} />
                        <div style={S.lancInfo}>
                          <span style={S.lancDesc}>{l.descricao}</span>
                          <div style={S.lancMeta}>
                            <span style={{
                              ...S.statusPill,
                              backgroundColor: `${STATUS_COR[l.status] ?? '#8B9BB4'}20`,
                              color: STATUS_COR[l.status] ?? '#8B9BB4',
                            }}>
                              {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                            </span>
                            <span style={S.catPill}>{l.categoria}</span>
                            {isVencimento && <span style={S.tagVenc}>Vencimento</span>}
                            {isPagamento  && <span style={S.tagPago}>Pagamento</span>}
                          </div>
                        </div>
                        <span style={S.lancValor}>{formatCurrency(Number(l.valor))}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', backgroundColor: '#0B1120' },
  main:   { marginLeft: 240, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 },

  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo:     { color: '#E2C97E', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitulo:  { color: '#8B9BB4', fontSize: 14, margin: '4px 0 0 0' },

  resumoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  resumoCard: {
    backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12,
    padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6,
  },
  resumoLabel: { color: '#8B9BB4', fontSize: 12 },
  resumoValor: { color: '#E2C97E', fontSize: 20, fontWeight: 700 },

  corpo: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' },

  // Calendário
  calCard: { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12, overflow: 'hidden' },
  calHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #1E2A3A', backgroundColor: '#111827',
  },
  navBtn: {
    background: 'none', border: '1px solid #1E2A3A', color: '#E2C97E',
    borderRadius: 8, width: 32, height: 32, cursor: 'pointer',
    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mesWrap:  { textAlign: 'center' },
  mesTitulo:{ color: '#F2F0EA', fontSize: 16, fontWeight: 700, display: 'block' },
  mesAno:   { color: '#E2C97E', fontSize: 12, letterSpacing: 1 },

  weekRow:      { display: 'flex' },
  weekDay:      { flex: 1, textAlign: 'center', fontSize: 11, color: '#8B9BB4', fontWeight: 700, padding: '10px 0' },
  weekDayFim:   { color: '#E2C97E' },

  loadingBox: { padding: 40, textAlign: 'center', color: '#8B9BB4', fontSize: 13 },

  grid: { padding: '4px 8px 12px' },

  dayCell: {
    flex: 1, minHeight: 52, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', borderRadius: 8,
    cursor: 'pointer', border: 'none', backgroundColor: 'transparent',
    padding: 4, gap: 3,
  },
  dayCellSelected: { backgroundColor: '#E2C97E' },
  dayCellToday:    { backgroundColor: '#1E2A3A', border: '1px solid #2A3A50' },
  dayText:         { fontSize: 13, color: '#8B9BB4', fontWeight: 500 },
  dayTextSelected: { color: '#000', fontWeight: 800 },
  dayTextToday:    { color: '#E2C97E', fontWeight: 800 },
  dotsRow:         { display: 'flex', gap: 3 },
  dot:             { width: 5, height: 5, borderRadius: '50%' },

  // Lista
  listaCard: { backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 12, overflow: 'hidden' },
  listaHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 20px', borderBottom: '1px solid #1E2A3A',
  },
  listaTitulo: { color: '#F2F0EA', fontSize: 15, fontWeight: 700 },
  listaCount:  { color: '#8B9BB4', fontSize: 12 },

  erroBox: {
    margin: 16, padding: 12, borderRadius: 8, fontSize: 13,
    backgroundColor: '#3D1515', border: '1px solid #C0392B', color: '#E87070',
  },

  vazio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, padding: '48px 20px',
  },
  vazioIcone: { fontSize: 32 },
  vazioTexto: { color: '#8B9BB4', fontSize: 13 },

  lancamentosList: { display: 'flex', flexDirection: 'column' },
  lancRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '14px 20px', borderBottom: '1px solid #1E2A3A',
  },
  lancBarra: { width: 3, minHeight: 40, borderRadius: 2, flexShrink: 0, marginTop: 2 },
  lancInfo:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  lancDesc:  { color: '#F2F0EA', fontSize: 13, fontWeight: 600 },
  lancMeta:  { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' },

  statusPill: { padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 },
  catPill:    { padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#8B9BB4', backgroundColor: '#1E2A3A' },
  tagVenc:    { padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#E67E22', backgroundColor: '#E67E2220' },
  tagPago:    { padding: '2px 8px', borderRadius: 4, fontSize: 11, color: '#27AE60', backgroundColor: '#27AE6020' },

  lancValor: { color: '#E2C97E', fontSize: 14, fontWeight: 700, flexShrink: 0 },
}
