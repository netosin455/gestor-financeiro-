// Fetch centralizado — nunca usar fetch diretamente nas páginas

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
  token?: string | null,
): Promise<T> {
  const { params, ...fetchOptions } = options

  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        qs.set(k, String(v))
      }
    }
    const qsStr = qs.toString()
    if (qsStr) url += `?${qsStr}`
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  }

  const response = await fetch(url, { ...fetchOptions, headers })

  if (!response.ok) {
    let message = `Erro ${response.status}`
    try {
      const body = await response.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignora erro de parse
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}
