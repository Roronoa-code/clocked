import { useCallback, useEffect, useRef, useState } from 'react'
import { currentParty, readRemoteData, signIn, signOut, writeRemoteData, type Party, type VersionedData } from '../utils/remoteState'
import type { ClockedData } from '../utils/validateState'

export function useRemoteClocked() {
  const [party, setParty] = useState<Party | null | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<VersionedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<VersionedData | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const apply = useCallback((next: VersionedData) => {
    if (!latest.current || next.version >= latest.current.version) {
      latest.current = next
      setSnapshot(next)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      apply(await readRemoteData())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Clocked data.')
    }
  }, [apply])

  useEffect(() => {
    let mounted = true
    currentParty().then(async found => {
      if (!mounted) return
      setParty(found)
      if (found) await refresh()
    }).catch(cause => {
      if (mounted) setError(cause instanceof Error ? cause.message : 'Could not check sign-in.')
    })
    return () => { mounted = false }
  }, [refresh])

  useEffect(() => {
    if (!party) return
    const check = () => { if (document.visibilityState === 'visible') void refresh() }
    const interval = window.setInterval(check, 5000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', check)
    }
  }, [party, refresh])

  const login = useCallback(async (name: Party, pin: string) => {
    await signIn(name, pin)
    setParty(name)
    await refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await signOut()
    latest.current = null
    setSnapshot(null)
    setParty(null)
    setError(null)
  }, [])

  const commit = useCallback((transform: (data: ClockedData) => ClockedData | null): Promise<boolean> => {
    const operation = queue.current.then(async () => {
      const current = latest.current
      if (!current) return false
      const next = transform(current.data)
      if (!next) return false
      try {
        const saved = await writeRemoteData(current, next)
        apply(saved)
        setError(null)
        return true
      } catch (cause) {
        await refresh()
        setError(cause instanceof Error ? cause.message : 'Could not save Clocked data.')
        return false
      }
    })
    queue.current = operation.then(() => undefined, () => undefined)
    return operation
  }, [apply, refresh])

  return { party, snapshot, error, login, logout, refresh, commit }
}
