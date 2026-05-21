'use client'

import { QuickEntry } from '../components/QuickEntry'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <QuickEntry />
    </>
  )
}
