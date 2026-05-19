'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { href: '/dashboard',   label: 'Dashboard',    icone: '📊' },
  { href: '/lancamentos', label: 'Lançamentos',   icone: '📋' },
  { href: '/calendario',  label: 'Calendário',    icone: '📅' },
  { href: '/relatorios',  label: 'Relatórios',    icone: '📈' },
  { href: '/alertas',     label: 'Alertas',       icone: '🔔' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside style={styles.sidebar}>
      <div style={styles.logo}>
        <span style={styles.logoTitulo}>Gestor Financeiro</span>
        <span style={styles.logoSlogan}>Planejar · Gerir · Fazer Crescer</span>
      </div>

      <nav style={styles.nav}>
        {navItems.map(item => {
          const ativo = pathname?.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              ...styles.navItem,
              ...(ativo ? styles.navItemAtivo : {}),
            }}>
              <span>{item.icone}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div style={styles.usuario}>
        {user && (
          <>
            <span style={styles.usuarioNome}>{user.name}</span>
            <span style={styles.usuarioRole}>{user.role}</span>
          </>
        )}
        <button onClick={logout} style={styles.btnSair}>
          Sair
        </button>
      </div>
    </aside>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width:           240,
    minHeight:       '100vh',
    backgroundColor: '#111827',
    borderRight:     '1px solid #1E2A3A',
    display:         'flex',
    flexDirection:   'column',
    padding:         24,
    position:        'fixed',
    top:             0,
    left:            0,
    bottom:          0,
  },
  logo: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    marginBottom:  40,
    paddingBottom: 24,
    borderBottom:  '1px solid #1E2A3A',
  },
  logoTitulo: {
    color:      '#E2C97E',
    fontSize:   16,
    fontWeight: 700,
  },
  logoSlogan: {
    color:    '#8B9BB4',
    fontSize: 10,
  },
  nav: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    flex:          1,
  },
  navItem: {
    display:      'flex',
    alignItems:   'center',
    gap:          10,
    padding:      '10px 12px',
    borderRadius: 8,
    color:        '#8B9BB4',
    fontSize:     14,
    cursor:       'pointer',
    transition:   'all 0.15s',
  },
  navItemAtivo: {
    backgroundColor: '#1E2A3A',
    color:           '#E2C97E',
  },
  usuario: {
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    paddingTop:    24,
    borderTop:     '1px solid #1E2A3A',
  },
  usuarioNome: {
    color:      '#F2F0EA',
    fontSize:   14,
    fontWeight: 500,
  },
  usuarioRole: {
    color:    '#8B9BB4',
    fontSize: 12,
  },
  btnSair: {
    marginTop:       8,
    background:      'none',
    border:          '1px solid #1E2A3A',
    color:           '#8B9BB4',
    borderRadius:    8,
    padding:         '8px 0',
    fontSize:        13,
    cursor:          'pointer',
    width:           '100%',
  },
}
