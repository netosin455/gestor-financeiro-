'use client'

import { useRef, useState } from 'react'
import { apiFetch } from '../services/api'

interface Categoria { id: string; nome: string }
interface PreviewRow {
  descricao: string
  valor:     number
  data:      string
  categoria: string
  catId:     string | null
  ok:        boolean
}

interface Props {
  isOpen:     boolean
  onClose:    () => void
  onSuccess:  (count: number) => void
  onError:    (msg: string) => void
  categorias: Categoria[]
  token:      string
}

const CAT_MAP: Record<string, string[]> = {
  'ÁGUA':                ['AGUA', 'ÁGUA'],
  'COMBUSTÍVEL':         ['COMBUSTIVEL', 'COMBUSTÍVEL'],
  'ENERGIA':             ['ENERGIA', 'LUZ'],
  'FOLHA DE PAGAMENTOS': ['FOLHA', 'SALÁRIO', 'SALARIO', 'FOLHA DE PAGAMENTOS'],
  'ALUGUEL':             ['ALUGUEL'],
  'INTERNET':            ['INTERNET'],
  'PLANO CELULAR':       ['PLANO CELULAR', 'CELULAR'],
  'MANUTENÇÃO':          ['MANUTENCAO', 'MANUTENÇÃO'],
  'FAXINA':              ['FAXINA', 'LIMPEZA'],
  'MATERIAL DE LIMPEZA': ['MATERIAL DE LIMP', 'MATERIAL DE LIMPEZA'],
  'TRIBUTOS':            ['TRIBUTOS', 'IMPOSTO'],
  'SEGURO':              ['SEGURO'],
  'FINANCIAMENTO':       ['FINANCIAMENTO'],
  'TARIFAS':             ['TARIFAS', 'TARIFA'],
  'EXTRA':               ['EXTRA', 'CAMPO', 'OUTROS'],
}

function normalizarNome(nome: string): string {
  return nome.toUpperCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function mapearCategoria(nomePlanilha: string, categorias: Categoria[]): string | null {
  const norm = normalizarNome(nomePlanilha)
  // Tenta correspondência direta pelo nome na DB
  const direta = categorias.find(c => normalizarNome(c.nome) === norm)
  if (direta) return direta.id
  // Tenta pelo mapa de aliases
  for (const [catNome, aliases] of Object.entries(CAT_MAP)) {
    if (aliases.some(a => normalizarNome(a) === norm)) {
      const cat = categorias.find(c => normalizarNome(c.nome) === normalizarNome(catNome))
      if (cat) return cat.id
    }
  }
  return null
}

// Converte serial de data do Excel para YYYY-MM-DD
function excelDateToISO(val: unknown): string | null {
  if (!val) return null
  // Se já for string formato ISO ou DD/MM/YYYY
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
      const [d, m, y] = val.split('/')
      return `${y}-${m}-${d}`
    }
  }
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000)
    if (isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }
  return null
}

export function ImportModal({ isOpen, onClose, onSuccess, onError, categorias, token }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview,   setPreview]   = useState<PreviewRow[]>([])
  const [fase,      setFase]      = useState<'upload' | 'preview' | 'importando' | 'resultado'>('upload')
  const [progresso, setProgresso] = useState({ atual: 0, total: 0, erros: 0, duplicados: 0 })
  const [nomeArq,   setNomeArq]   = useState('')

  if (!isOpen) return null

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setNomeArq(file.name)

    try {
      const XLSX = await import('xlsx')
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: 'array' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]

      // Detecta cabeçalho — procura linha com DATA/DESCRI/VALOR
      let headerIdx = 0
      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i].map(c => String(c ?? '').toUpperCase())
        if (row.some(c => c.includes('DATA') || c.includes('DESCRI') || c.includes('VALOR'))) {
          headerIdx = i
          break
        }
      }
      const headers = rows[headerIdx].map(c => String(c ?? '').toUpperCase().trim())
      const dataRows = rows.slice(headerIdx + 1)

      const colIdx = (nomes: string[]) => nomes.reduce((acc, n) => {
        const i = headers.findIndex(h => h.includes(n))
        return i >= 0 ? i : acc
      }, -1)

      const iData = colIdx(['DATA'])
      const iDesc = colIdx(['DESCRI', 'HIST', 'LANÇAM'])
      const iValor = colIdx(['VALOR', 'R$', 'TOTAL'])
      const iCat  = colIdx(['CATEG', 'TIPO'])

      const parsed: PreviewRow[] = []
      for (const row of dataRows) {
        if (!row || row.every(c => !c)) continue
        const dataISO = excelDateToISO(row[iData])
        const valorRaw = parseFloat(String(row[iValor] ?? '').replace(',', '.'))
        const desc = String(row[iDesc] ?? '').trim()
        const catNome = iCat >= 0 ? String(row[iCat] ?? '').trim() : ''
        if (!dataISO || !desc || !valorRaw || valorRaw <= 0) continue
        const catId = mapearCategoria(catNome, categorias)
        parsed.push({ descricao: desc, valor: valorRaw, data: dataISO, categoria: catNome, catId, ok: !!catId })
      }

      setPreview(parsed)
      setFase('preview')
    } catch {
      onError('Erro ao ler arquivo. Verifique se é um .xlsx ou .csv válido.')
    }
  }

  const handleImportar = async () => {
    setFase('importando')
    let criados = 0
    let erros   = 0
    let duplicados = 0
    setProgresso({ atual: 0, total: preview.length, erros: 0, duplicados: 0 })

    // Busca lançamentos existentes dos meses que estão no import para checar duplicatas
    const mesesImport = [...new Set(preview.map(r => r.data.slice(0, 7)))]
    const existentes = new Set<string>()
    for (const mes of mesesImport) {
      try {
        const resp = await apiFetch<{ data: { descricao: string; valor: number; data_lancamento: string }[] }>(
          '/api/lancamentos',
          { params: { mes, limit: 500 } },
          token,
        )
        for (const l of resp.data) {
          const key = `${l.descricao.trim().toLowerCase()}|${String(l.data_lancamento).slice(0, 10)}|${Number(l.valor).toFixed(2)}`
          existentes.add(key)
        }
      } catch { /* ignora erro de busca — prossegue sem checar duplicatas desse mês */ }
    }

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i]
      if (!row.catId) { erros++; setProgresso({ atual: i + 1, total: preview.length, erros, duplicados }); continue }

      const key = `${row.descricao.trim().toLowerCase()}|${row.data}|${row.valor.toFixed(2)}`
      if (existentes.has(key)) {
        duplicados++
        setProgresso(p => ({ ...p, atual: i + 1, duplicados }))
        continue
      }

      try {
        await apiFetch('/api/lancamentos', {
          method: 'POST',
          body:   JSON.stringify({
            descricao:       row.descricao,
            categoria_id:    row.catId,
            valor:           row.valor,
            data_lancamento: row.data,
            status:          'pendente',
          }),
        }, token)
        criados++
        existentes.add(key)
      } catch {
        erros++
      }
      setProgresso({ atual: i + 1, total: preview.length, erros, duplicados })
    }

    setFase('resultado')
    setProgresso(p => ({ ...p, erros, duplicados }))
    if (criados > 0) onSuccess(criados)
  }

  const resetar = () => {
    setFase('upload')
    setPreview([])
    setNomeArq('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const okRows  = preview.filter(r => r.ok)
  const semCat  = preview.filter(r => !r.ok)

  return (
    <div style={overlay} onClick={fase === 'importando' ? undefined : onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        <div style={modalHeader}>
          <h2 style={modalTitulo}>Importar Planilha</h2>
          {fase !== 'importando' && (
            <button onClick={onClose} style={btnFechar}>✕</button>
          )}
        </div>

        {/* Fase: upload */}
        {fase === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <p style={{ color: '#8B9BB4', fontSize: 14, margin: 0 }}>
              Selecione um arquivo <strong style={{ color: '#E2C97E' }}>.xlsx</strong> ou <strong style={{ color: '#E2C97E' }}>.csv</strong> com os lançamentos.
              O sistema detecta automaticamente as colunas de data, descrição, valor e categoria.
            </p>
            <label style={dropzone}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFile}
              />
              <div style={{ fontSize: 36 }}>📂</div>
              <div style={{ color: '#E2C97E', fontWeight: 600, marginTop: 8 }}>
                Clique para selecionar arquivo
              </div>
              <div style={{ color: '#8B9BB4', fontSize: 13, marginTop: 4 }}>
                Formatos: .xlsx, .xls, .csv
              </div>
            </label>
          </div>
        )}

        {/* Fase: preview */}
        {fase === 'preview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={chip('#0D3320', '#27AE60')}>✅ {okRows.length} prontos para importar</div>
              {semCat.length > 0 && (
                <div style={chip('#2D1F0A', '#E67E22')}>⚠️ {semCat.length} sem categoria (serão ignorados)</div>
              )}
            </div>
            <p style={{ color: '#8B9BB4', fontSize: 12, margin: 0 }}>
              Arquivo: <strong style={{ color: '#F2F0EA' }}>{nomeArq}</strong> · {preview.length} linhas lidas
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto', borderRadius: 8, border: '1px solid #1E2A3A' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Data', 'Descrição', 'Categoria', 'Valor', 'OK?'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.data.split('-').reverse().join('/')}</td>
                      <td style={{ ...td, maxWidth: 200 }}>{r.descricao}</td>
                      <td style={{ ...td, color: r.ok ? '#27AE60' : '#E67E22', fontSize: 12 }}>
                        {r.categoria || '—'}
                      </td>
                      <td style={{ ...td, color: '#E2C97E' }}>
                        R$ {r.valor.toFixed(2).replace('.', ',')}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>{r.ok ? '✅' : '⚠️'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 50 && (
                <div style={{ padding: '8px 16px', color: '#8B9BB4', fontSize: 12 }}>
                  ... e mais {preview.length - 50} linhas
                </div>
              )}
            </div>
            <div style={botoesContainer}>
              <button onClick={resetar} style={btnCancelar}>Trocar arquivo</button>
              <button
                onClick={handleImportar}
                style={{ ...btnSalvar, opacity: okRows.length === 0 ? 0.5 : 1 }}
                disabled={okRows.length === 0}
              >
                Importar {okRows.length} lançamentos
              </button>
            </div>
          </div>
        )}

        {/* Fase: importando */}
        {fase === 'importando' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', padding: '32px 0' }}>
            <div style={{ color: '#E2C97E', fontSize: 16, fontWeight: 600 }}>
              Importando lançamentos...
            </div>
            <div style={{ width: '100%', backgroundColor: '#0D1520', borderRadius: 8, height: 12, overflow: 'hidden' }}>
              <div style={{
                width: `${(progresso.atual / progresso.total) * 100}%`,
                height: '100%', backgroundColor: '#C9A84C',
                transition: 'width 0.2s',
              }} />
            </div>
            <div style={{ color: '#8B9BB4', fontSize: 14 }}>
              {progresso.atual} / {progresso.total}
              {progresso.erros > 0 && <span style={{ color: '#E67E22' }}> · {progresso.erros} erros</span>}
            </div>
          </div>
        )}

        {/* Fase: resultado */}
        {fase === 'resultado' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={chip('#0D3320', '#27AE60')}>
              ✅ {progresso.total - progresso.erros - progresso.duplicados} lançamentos importados
            </div>
            {progresso.duplicados > 0 && (
              <div style={chip('#0D1A2D', '#2980B9')}>
                🔁 {progresso.duplicados} duplicatas ignoradas
              </div>
            )}
            {progresso.erros > 0 && (
              <div style={chip('#2D1F0A', '#E67E22')}>
                ⚠️ {progresso.erros} registros com erro (sem categoria)
              </div>
            )}
            <button onClick={onClose} style={btnSalvar}>Fechar e Atualizar</button>
          </div>
        )}
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const modal: React.CSSProperties = {
  backgroundColor: '#111827', border: '1px solid #1E2A3A', borderRadius: 14,
  width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', padding: 28,
}
const modalHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
}
const modalTitulo: React.CSSProperties = { color: '#E2C97E', fontSize: 18, fontWeight: 700, margin: 0 }
const btnFechar: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8B9BB4', fontSize: 18, cursor: 'pointer', padding: '4px 8px',
}
const dropzone: React.CSSProperties = {
  border: '2px dashed #1E2A3A', borderRadius: 12, padding: 40,
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  cursor: 'pointer', textAlign: 'center',
}
const botoesContainer: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 12 }
const btnCancelar: React.CSSProperties = {
  backgroundColor: 'transparent', border: '1px solid #1E2A3A',
  color: '#8B9BB4', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
}
const btnSalvar: React.CSSProperties = {
  backgroundColor: '#C9A84C', border: 'none', color: '#0A0E1A',
  borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
const th: React.CSSProperties = {
  color: '#8B9BB4', fontSize: 11, fontWeight: 600, textAlign: 'left',
  padding: '8px 12px', backgroundColor: '#0D1520', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  color: '#F2F0EA', fontSize: 12, padding: '8px 12px', borderBottom: '1px solid #0D1520',
}

function chip(bg: string, border: string): React.CSSProperties {
  return {
    backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 20,
    padding: '4px 12px', color: border, fontSize: 13, fontWeight: 500, display: 'inline-block',
  }
}
