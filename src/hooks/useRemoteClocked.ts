import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, currentParty, readRemoteData, signIn, signOut, writeRemoteData, type Party, type VersionedData } from '../utils/remoteState'
import type { ClockedData } from '../utils/validateState'

export function useRemoteClocked() {
  const [party, setParty] = useState<Party | null | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<VersionedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<VersionedData | null>(null)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const sessionEpoch = useRef(0)

  const apply = useCallback((next: VersionedData) => {
    if (!latest.current || next.version >= latest.current.version) {
      latest.current = next
      setSnapshot(next)
    }
  }, [])

  const refresh = useCallback(async () => {
    const epoch = sessionEpoch.current
    try {
      const next = await readRemoteData()
      if (epoch !== sessionEpoch.current) return
      apply(next)
      setError(null)
    } catch (cause) {
      if (epoch !== sessionEpoch.current) return
      if (cause instanceof ApiError && cause.status === 401) {
        sessionEpoch.current++
        latest.current = null
        setSnapshot(null)
        setParty(null)
        setError(null)
        return
      }
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
    sessionEpoch.current++
    latest.current = null
    setSnapshot(null)
    setParty(name)
    await refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    await signOut()
    sessionEpoch.current++
    latest.current = null
    setSnapshot(null)
    setParty(null)
    setError(null)
  }, [])

  const commit = useCallback((transform: (data: ClockedData) => ClockedData | null): Promise<boolean> => {
    const epoch = sessionEpoch.current
    const operation = queue.current.then(async () => {
      if (epoch !== sessionEpoch.current) return false
      const current = latest.current
      if (!current) return false
      const next = transform(current.data)
      if (!next) return false
      try {
        const saved = await writeRemoteData(current, next)
        if (epoch !== sessionEpoch.current) return false
        apply(saved)
        setError(null)
        return true
      } catch (cause) {
        if (epoch !== sessionEpoch.current) return false
        await refresh()
        if (epoch !== sessionEpoch.current) return false
        setError(cause instanceof Error ? cause.message : 'Could not save Clocked data.')
        return false
      }
    })
    queue.current = operation.then(() => undefined, () => undefined)
    return operation
  }, [apply, refresh])

  return { party, snapshot, error, login, logout, refresh, commit }
}
