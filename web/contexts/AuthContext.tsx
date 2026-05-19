'use client'

import {
  createContext, useContext, useState, useEffect, useCallback,
  type ReactNode,
} from 'react'
import type { User, LoginRequest, LoginResponse } from '../../types'

interface AuthContextValue {
  user:    Omit<User, 'password_hash'> | null
  token:   string | null
  loading: boolean
  login:   (credentials: LoginRequest) => Promise<void>
  logout:  () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'gf_token'
const USER_KEY  = 'gf_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<Omit<User, 'password_hash'> | null>(null)
  const [token,   setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaura sessão do localStorage na montagem
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY)
      const savedUser  = localStorage.getItem(USER_KEY)
      if (savedToken && savedUser) {
        setToken(savedToken)
        setUser(JSON.parse(savedUser) as Omit<User, 'password_hash'>)
      }
    } catch {
      // localStorage indisponível (SSR) — ignora
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (credentials: LoginRequest) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
    const response = await fetch(`${apiBase}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(credentials),
    })

    if (!response.ok) {
      const body = await response.json() as { error: string }
      throw new Error(body.error ?? 'Erro ao fazer login')
    }

    const data = await response.json() as LoginResponse
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY,  JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
