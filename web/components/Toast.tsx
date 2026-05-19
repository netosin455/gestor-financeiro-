'use client'

import { useState, useCallback } from 'react'

export interface ToastItem {
  id:      number
  type:    'success' | 'error' | 'info'
  message: string
  icon:    string
}

let _id = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((type: ToastItem['type'], message: string) => {
    const id   = ++_id
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'
    setToasts(prev => [...prev, { id, type, message, icon }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error', msg),
    info:    (msg: string) => addToast('info', msg),
  }

  return { toasts, toast }
}

const COLORS: Record<ToastItem['type'], { bg: string; border: string }> = {
  success: { bg: '#0D3320', border: '#27AE60' },
  error:   { bg: '#3D1515', border: '#C0392B' },
  info:    { bg: '#0D1A2D', border: '#2980B9' },
}

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom:   24,
      right:    24,
      zIndex:   9999,
      display:  'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {toasts.map(t => {
        const c = COLORS[t.type]
        return (
          <div key={t.id} style={{
            backgroundColor: c.bg,
            border:          `1px solid ${c.border}`,
            borderRadius:    10,
            padding:         '12px 16px',
            color:           '#F2F0EA',
            fontSize:        14,
            display:         'flex',
            alignItems:      'center',
            gap:             10,
            minWidth:        280,
            maxWidth:        400,
            boxShadow:       '0 4px 20px rgba(0,0,0,0.4)',
          }}>
            <span>{t.icon}</span>
            <span>{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
