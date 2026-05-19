'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '../services/api'

interface Categoria { id: string; nome: string; grupo: string; cor: string }
interface Unidade   { id: string; nome: string }

interface Lancamento {
  id: string
  descricao: string
  categoria_id: string
  unidade_id:   string | null
  valor:        number
  tipo:         string
  setor:        string | null
  data_lancamento:  string
  data_vencimento:  string | null
  data_pagamento:   string | null
  status:       string
  observacoes:  string | null
}

interface Props {
  isOpen:     boolean
  onClose:    () => void
  onSuccess:  (msg: string) => void
  onError:    (msg: string) => void
  lancamento: Lancamento | null   // null = criar, preenchido = editar
  token:      string
}

const hoje = () => new Date().toISOString().slice(0, 10)

export function LancamentoModal({ isOpen, onClose, onSuccess, onError, lancamento, token }: Props) {
  const editando = lancamento !== null

  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [unidades,   setUnidades]   = useState<Unidade[]>([])
  const [salvando,   setSalvando]   = useState(false)

  // Form state
  const [tipo,             setTipo]             = useState<'saida' | 'entrada'>('saida')
  const [descricao,        setDescricao]        = useState('')
  const [categoriaId,      setCategoriaId]      = useState('')
  const [unidadeId,        setUnidadeId]        = useState('')
  const [valor,            setValor]            = useState('')
  const [dataLancamento,   setDataLancamento]   = useState(hoje())
  const [dataVencimento,   setDataVencimento]   = useState('')
  const [dataPagamento,    setDataPagamento]    = useState('')
  const [status,           setStatus]           = useState('pendente')
  const [setor,            setSetor]            = useState('')
  const [observacoes,      setObservacoes]      = useState('')

  const categoriasVisiveis = categorias.filter(c =>
    tipo === 'entrada' ? c.grupo === 'entrada' : c.grupo !== 'entrada'
  )

  // Carrega meta (categorias + unidades) quando abre
  useEffect(() => {
    if (!isOpen) return
    apiFetch<{ data: { categorias: Categoria[]; unidades: Unidade[] } }>(
      '/api/lancamentos',
      { params: { meta: '1' } },
      token,
    ).then(r => {
      setCategorias(r.data.categorias)
      setUnidades(r.data.unidades)
    }).catch(() => {})
  }, [isOpen, token])

  // Preenche formulário quando editando
  useEffect(() => {
    if (!isOpen) return
    if (lancamento) {
      setTipo((lancamento.tipo as 'saida' | 'entrada') ?? 'saida')
      setDescricao(lancamento.descricao)
      setCategoriaId(lancamento.categoria_id)
      setUnidadeId(lancamento.unidade_id ?? '')
      setValor(String(lancamento.valor))
      setDataLancamento(String(lancamento.data_lancamento).slice(0, 10))
      setDataVencimento(lancamento.data_vencimento ? String(lancamento.data_vencimento).slice(0, 10) : '')
      setDataPagamento(lancamento.data_pagamento ? String(lancamento.data_pagamento).slice(0, 10) : '')
      setStatus(lancamento.status)
      setSetor(lancamento.setor ?? '')
      setObservacoes(lancamento.observacoes ?? '')
    } else {
      setTipo('saida')
      setDescricao('')
      setCategoriaId('')
      setUnidadeId('')
      setValor('')
      setDataLancamento(hoje())
      setDataVencimento('')
      setDataPagamento('')
      setStatus('pendente')
      setSetor('')
      setObservacoes('')
    }
  }, [isOpen, lancamento])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim())  return onError('Descrição é obrigatória')
    if (!categoriaId)       return onError('Selecione uma categoria')
    const valorNum = parseFloat(valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) return onError('Valor deve ser maior que zero')

    setSalvando(true)
    try {
      const body = {
        tipo,
        descricao:       descricao.trim(),
        categoria_id:    categoriaId,
        unidade_id:      unidadeId || null,
        valor:           valorNum,
        setor:           tipo === 'entrada' ? null : (setor || null),
        data_lancamento: dataLancamento,
        data_vencimento: tipo === 'entrada' ? null : (dataVencimento || null),
        data_pagamento:  dataPagamento  || null,
        status:          tipo === 'entrada' ? 'pago' : status,
        pago:            tipo === 'entrada' ? true : status === 'pago',
        observacoes:     observacoes.trim() || null,
      }

      if (editando) {
        await apiFetch(`/api/lancamentos/${lancamento!.id}`, {
          method: 'PUT',
          body:   JSON.stringify(body),
        }, token)
        onSuccess('Lançamento atualizado com sucesso!')
      } else {
        await apiFetch('/api/lancamentos', {
          method: 'POST',
          body:   JSON.stringify(body),
        }, token)
        onSuccess('Lançamento criado com sucesso!')
      }
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={modalHeader}>
          <h2 style={modalTitulo}>
            {editando ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={onClose} style={btnFechar}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          {/* Toggle Entrada / Saída */}
          {!editando && (
            <div style={toggleContainer}>
              <button
                type="button"
                style={{ ...toggleBtn, ...(tipo === 'saida' ? toggleAtivo('#C0392B') : {}) }}
                onClick={() => { setTipo('saida'); setCategoriaId('') }}
              >
                💸 Saída
              </button>
              <button
                type="button"
                style={{ ...toggleBtn, ...(tipo === 'entrada' ? toggleAtivo('#27AE60') : {}) }}
                onClick={() => { setTipo('entrada'); setCategoriaId('') }}
              >
                💰 Entrada
              </button>
            </div>
          )}

          {/* Descrição */}
          <div style={grupo}>
            <label style={label}>Descrição *</label>
            <input
              style={input}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Conta de energia — Unidade Centro"
              required
            />
          </div>

          {/* Categoria + Unidade */}
          <div style={linha2}>
            <div style={grupo}>
              <label style={label}>Categoria *</label>
              <select style={input} value={categoriaId} onChange={e => setCategoriaId(e.target.value)} required>
                <option value="">Selecione...</option>
                {categoriasVisiveis.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div style={grupo}>
              <label style={label}>Unidade</label>
              <select style={input} value={unidadeId} onChange={e => setUnidadeId(e.target.value)}>
                <option value="">Todas / Global</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor + Data lançamento */}
          <div style={linha2}>
            <div style={grupo}>
              <label style={label}>Valor (R$) *</label>
              <input
                style={input}
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div style={grupo}>
              <label style={label}>Data do Lançamento *</label>
              <input style={input} type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)} required />
            </div>
          </div>

          {/* Vencimento + Pagamento (saída) / só Recebimento (entrada) */}
          <div style={linha2}>
            {tipo === 'saida' && (
              <div style={grupo}>
                <label style={label}>Data de Vencimento</label>
                <input style={input} type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
              </div>
            )}
            <div style={grupo}>
              <label style={label}>{tipo === 'entrada' ? 'Data de Recebimento' : 'Data de Pagamento'}</label>
              <input style={input} type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
          </div>

          {/* Status + Setor (só para saídas) */}
          {tipo === 'saida' && (
            <div style={linha2}>
              <div style={grupo}>
                <label style={label}>Status</label>
                <select style={input} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div style={grupo}>
                <label style={label}>Setor</label>
                <select style={input} value={setor} onChange={e => setSetor(e.target.value)}>
                  <option value="">Não definido</option>
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="CAMPO">Campo</option>
                  <option value="FOLHA DE PAGAMENTOS">Folha de Pagamentos</option>
                  <option value="TRIBUTOS">Tributos</option>
                </select>
              </div>
            </div>
          )}

          {/* Observações */}
          <div style={grupo}>
            <label style={label}>Observações</label>
            <textarea
              style={{ ...input, height: 72, resize: 'vertical' }}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Informações adicionais..."
            />
          </div>

          {/* Botões */}
          <div style={botoesContainer}>
            <button type="button" onClick={onClose} style={btnCancelar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" style={btnSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Criar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.7)',
  zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
}
const modal: React.CSSProperties = {
  backgroundColor: '#111827',
  border: '1px solid #1E2A3A',
  borderRadius: 14,
  width: '100%', maxWidth: 620,
  maxHeight: '90vh', overflowY: 'auto',
  padding: 28,
}
const modalHeader: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 24,
}
const modalTitulo: React.CSSProperties = { color: '#E2C97E', fontSize: 18, fontWeight: 700, margin: 0 }
const btnFechar: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8B9BB4',
  fontSize: 18, cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
}
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 }
const grupo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }
const linha2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
const label: React.CSSProperties = { color: '#8B9BB4', fontSize: 12, fontWeight: 500 }
const input: React.CSSProperties = {
  backgroundColor: '#0D1520', border: '1px solid #1E2A3A',
  color: '#F2F0EA', borderRadius: 8, padding: '10px 12px', fontSize: 14,
  width: '100%', boxSizing: 'border-box',
}
const botoesContainer: React.CSSProperties = {
  display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8,
}
const btnCancelar: React.CSSProperties = {
  backgroundColor: 'transparent', border: '1px solid #1E2A3A',
  color: '#8B9BB4', borderRadius: 8, padding: '10px 20px',
  fontSize: 14, cursor: 'pointer',
}
const btnSalvar: React.CSSProperties = {
  backgroundColor: '#C9A84C', border: 'none',
  color: '#0A0E1A', borderRadius: 8, padding: '10px 24px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
}
const toggleContainer: React.CSSProperties = {
  display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden',
  border: '1px solid #1E2A3A',
}
const toggleBtn: React.CSSProperties = {
  flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', border: 'none', backgroundColor: '#0D1520', color: '#8B9BB4',
  transition: 'all 0.15s',
}
function toggleAtivo(cor: string): React.CSSProperties {
  return { backgroundColor: cor + '22', color: cor, borderBottom: `2px solid ${cor}` }
}
