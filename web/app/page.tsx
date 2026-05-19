import { redirect } from 'next/navigation'

// Redireciona raiz para o dashboard
export default function RootPage() {
  redirect('/dashboard')
}
