'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../contexts/AuthContext'

export default function LoginPage() {
  const { user, login, loading: authLoading } = useAuth()
  const router = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [erro,     setErro]     = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/dashboard')
    }
  }, [authLoading, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      await login({ email, password })
      router.replace('/dashboard')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return null

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo / identidade */}
        <div style={styles.logoArea}>
          <h1 style={styles.logoTitulo}>Gestor Financeiro</h1>
          <p style={styles.logoSlogan}>Planejar · Gerir · Fazer Crescer</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.campo}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              autoFocus
              style={styles.input}
            />
          </div>

          <div style={styles.campo}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          {erro && <div style={styles.erro}>{erro}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight:       '100vh',
    backgroundColor: '#0A0E1A',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  card: {
    backgroundColor: '#111827',
    border:          '1px solid #1E2A3A',
    borderRadius:    16,
    padding:         '40px 48px',
    width:           '100%',
    maxWidth:        420,
    display:         'flex',
    flexDirection:   'column',
    gap:             32,
  },
  logoArea: {
    textAlign: 'center',
  },
  logoTitulo: {
    color:      '#E2C97E',
    fontSize:   24,
    fontWeight: 700,
    margin:     0,
  },
  logoSlogan: {
    color:    '#8B9BB4',
    fontSize: 13,
    margin:   '6px 0 0 0',
  },
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           20,
  },
  campo: {
    display:       'flex',
    flexDirection: 'column',
    gap:           8,
  },
  label: {
    color:    '#8B9BB4',
    fontSize: 13,
    fontWeight: 500,
  },
  input: {
    backgroundColor: '#0A0E1A',
    border:          '1px solid #1E2A3A',
    borderRadius:    8,
    color:           '#F2F0EA',
    fontSize:        15,
    padding:         '12px 14px',
    outline:         'none',
    width:           '100%',
  },
  erro: {
    backgroundColor: '#2D0F0F',
    border:          '1px solid #C0392B',
    borderRadius:    8,
    color:           '#E87070',
    fontSize:        13,
    padding:         '10px 14px',
  },
  btn: {
    backgroundColor: '#C9A84C',
    border:          'none',
    borderRadius:    8,
    color:           '#0A0E1A',
    cursor:          'pointer',
    fontSize:        15,
    fontWeight:      700,
    padding:         '14px 0',
    width:           '100%',
    marginTop:       4,
  },
  btnDisabled: {
    backgroundColor: '#7A6230',
    cursor:          'not-allowed',
  },
}
