import { useCallback, useEffect, useState } from 'react'

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const json = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(json?.error ?? `${res.status} ${res.statusText}`)
  return json as T
}

export interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

export function useApi<T>(path: string): FetchState<T> {
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<Omit<FetchState<T>, 'reload'>>({
    data: null,
    loading: true,
    error: null,
  })
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true, error: null }))
    apiGet<T>(path)
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((err: unknown) =>
        active &&
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Request failed',
        }),
      )
    return () => {
      active = false
    }
  }, [path, tick])

  return { ...state, reload }
}
