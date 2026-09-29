import { useState, useEffect, useRef, useCallback } from 'react'
import type { ActiveSession, WorkSession, Agreement, ActiveSessionStatus } from '../types'
import {
  loadActiveSession,
  saveActiveSession,
  subscribeToSync,
} from '../utils/storage'
import { calculateSessionValues } from '../utils/calculations'

interface UseClockedTimerProps {
  agreement: Agreement | null
  onSaveSession: (session: WorkSession) => Promise<boolean>
  initialActiveSession?: ActiveSession | null
  onPersistActiveSession?: (
    session: ActiveSession | null,
    expected: ActiveSession | null
  ) => Promise<boolean>
}

interface PendingSave {
  record: WorkSession
  activeSession: ActiveSession
  expectedActiveSession: ActiveSession
  activePersisted: boolean
  persisted: boolean
}

export function useClockedTimer({
  agreement,
  onSaveSession,
  initialActiveSession,
  onPersistActiveSession,
}: UseClockedTimerProps) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() =>
    initialActiveSession === undefined ? loadActiveSession() : initialActiveSession
  )
  const [taskNoteDraft, setTaskNoteDraft] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [timerStatus, setTimerStatus] = useState<ActiveSessionStatus>('idle')
  const [lastSavedInfo, setLastSavedInfo] = useState<{ duration: string; gbpAmount: string } | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const isSavingRef = useRef(false)
  const isPersistingRef = useRef(false)
  const pendingSaveRef = useRef<PendingSave | null>(null)
  const deferredSessionRef = useRef<ActiveSession | null | undefined>(undefined)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedNoticeRef = useRef(false)

  const clearSavedTimeout = useCallback(() => {
    if (savedTimeoutRef.current !== null) {
      clearTimeout(savedTimeoutRef.current)
      savedTimeoutRef.current = null
    }
  }, [])

  const persistActiveSession = useCallback(async (
    session: ActiveSession | null,
    expected: ActiveSession | null = null
  ) => {
    try {
      return onPersistActiveSession
        ? await onPersistActiveSession(session, expected)
        : saveActiveSession(session)
    } catch (err) {
      console.error('Failed to persist active session:', err)
      return false
    }
  }, [onPersistActiveSession])

  // Calculate current elapsed seconds from activeSession timestamps.
  const computeElapsedSeconds = useCallback((session: ActiveSession | null): number => {
    if (!session) return 0
    let totalMs = session.activeDurationMs
    if (session.status === 'running' && session.currentRunStartedAt) {
      totalMs += Math.max(0, Date.now() - session.currentRunStartedAt)
    }
    return Math.floor(totalMs / 1000)
  }, [])

  const rehydrateFromServer = useCallback((session: ActiveSession | null) => {
    const pending = pendingSaveRef.current
    if (pending && session?.id === pending.activeSession.id) {
      setActiveSession(pending.activeSession)
      return
    }
    if (pending) pendingSaveRef.current = null
    if (session) {
      savedNoticeRef.current = false
      clearSavedTimeout()
      setLastSavedInfo(null)
    } else if (!savedNoticeRef.current) {
      clearSavedTimeout()
      setTimerStatus('idle')
      setSaveErrorMessage(null)
      setLastSavedInfo(null)
    }
    setActiveSession(session)
  }, [clearSavedTimeout])

  // Rehydrate sessions received from the server, except while a save owns a frozen snapshot.
  useEffect(() => {
    if (initialActiveSession === undefined) return
    if (isSavingRef.current) {
      deferredSessionRef.current = initialActiveSession
      return
    }
    rehydrateFromServer(initialActiveSession)
  }, [initialActiveSession, rehydrateFromServer])

  // Sync elapsed seconds and status from activeSession timestamps.
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0)
      setTimerStatus((current) =>
        current === 'saved' || current === 'save_failed' || current === 'saving'
          ? current
          : 'idle'
      )
      return
    }

    setElapsedSeconds(computeElapsedSeconds(activeSession))
    setTimerStatus((current) => {
      if (isSavingRef.current && current === 'saving') return current
      if (pendingSaveRef.current?.activeSession.id === activeSession.id && current === 'save_failed') {
        return current
      }
      return activeSession.status
    })
  }, [activeSession, computeElapsedSeconds])

  // Ticking effect when running.
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return

    const interval = setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(activeSession))
    }, 200)

    return () => clearInterval(interval)
  }, [activeSession, computeElapsedSeconds])

  // Local multi-tab sync is a fallback when the app has no server session callback.
  useEffect(() => {
    if (onPersistActiveSession) return

    const unsubscribe = subscribeToSync((message) => {
      if (message.type === 'ACTIVE_SESSION_UPDATE') {
        clearSavedTimeout()
        savedNoticeRef.current = false
        setLastSavedInfo(null)
        if (!message.activeSession) setTimerStatus('idle')
        if (pendingSaveRef.current && message.activeSession?.id !== pendingSaveRef.current.activeSession.id) {
          pendingSaveRef.current = null
        }
        setActiveSession(message.activeSession)
      }
    })
    return unsubscribe
  }, [clearSavedTimeout, onPersistActiveSession])

  const flushDeferredSession = useCallback((saveSucceeded: boolean) => {
    if (saveSucceeded) {
      deferredSessionRef.current = undefined
      return
    }
    const deferredSession = deferredSessionRef.current
    deferredSessionRef.current = undefined
    if (deferredSession !== undefined) rehydrateFromServer(deferredSession)
  }, [rehydrateFromServer])

  useEffect(() => clearSavedTimeout, [clearSavedTimeout])

  // Action: Clock In.
  const clockIn = useCallback(async (initialTaskNote: string = taskNoteDraft): Promise<boolean> => {
    if (!agreement || activeSession || isSavingRef.current || isPersistingRef.current) return false
    isPersistingRef.current = true
    clearSavedTimeout()
    savedNoticeRef.current = false
    setTimerStatus('idle')
    setLastSavedInfo(null)
    const now = Date.now()
    const newSession: ActiveSession = {
      id: 'session-' + now + '-' + Math.random().toString(36).substring(2, 7),
      agreementId: agreement.id,
      startedAt: now,
      activeDurationMs: 0,
      currentRunStartedAt: now,
      status: 'running',
      taskNote: initialTaskNote,
    }

    try {
      if (!(await persistActiveSession(newSession, null))) {
        setSaveErrorMessage("Couldn't save your session. Please try again.")
        return false
      }
      pendingSaveRef.current = null
      setActiveSession(newSession)
      setTaskNoteDraft('')
      setTimerStatus('running')
      setSaveErrorMessage(null)
      setLastSavedInfo(null)
      return true
    } finally {
      isPersistingRef.current = false
    }
  }, [activeSession, agreement, clearSavedTimeout, persistActiveSession, taskNoteDraft])

  // Action: Pause.
  const pause = useCallback(async (): Promise<boolean> => {
    if (!activeSession || activeSession.status !== 'running' || isSavingRef.current || isPersistingRef.current) {
      return false
    }
    isPersistingRef.current = true
    const now = Date.now()
    const addedMs = activeSession.currentRunStartedAt
      ? Math.max(0, now - activeSession.currentRunStartedAt)
      : 0
    const updated: ActiveSession = {
      ...activeSession,
      activeDurationMs: activeSession.activeDurationMs + addedMs,
      currentRunStartedAt: null,
      status: 'paused',
    }

    try {
      if (!(await persistActiveSession(updated, activeSession))) {
        setSaveErrorMessage("Couldn't save your changes. Your session is kept.")
        return false
      }
      setActiveSession(updated)
      setTimerStatus('paused')
      setSaveErrorMessage(null)
      return true
    } finally {
      isPersistingRef.current = false
    }
  }, [activeSession, persistActiveSession])

  // Action: Resume.
  const resume = useCallback(async (): Promise<boolean> => {
    if (!activeSession || activeSession.status !== 'paused' || isSavingRef.current || isPersistingRef.current) {
      return false
    }
    isPersistingRef.current = true
    const now = Date.now()
    const updated: ActiveSession = {
      ...activeSession,
      currentRunStartedAt: now,
      status: 'running',
    }

    try {
      if (!(await persistActiveSession(updated, activeSession))) {
        setSaveErrorMessage("Couldn't save your changes. Your session is kept.")
        return false
      }
      pendingSaveRef.current = null
      setActiveSession(updated)
      setTimerStatus('running')
      setSaveErrorMessage(null)
      return true
    } finally {
      isPersistingRef.current = false
    }
  }, [activeSession, persistActiveSession])

  // Action: Correct time, optionally committing the task edit in the same write.
  const correctTime = useCallback(async (newDurationSec: number, taskNote?: string): Promise<boolean> => {
    if (
      !activeSession || activeSession.status !== 'paused' || isSavingRef.current || isPersistingRef.current ||
      !Number.isFinite(newDurationSec) || newDurationSec < 0
    ) {
      return false
    }
    isPersistingRef.current = true
    const updated: ActiveSession = {
      ...activeSession,
      activeDurationMs: Math.floor(newDurationSec) * 1000,
      currentRunStartedAt: null,
      ...(taskNote === undefined ? {} : { taskNote }),
    }

    try {
      if (!(await persistActiveSession(updated, activeSession))) {
        setSaveErrorMessage("Couldn't save your changes. Your session is kept.")
        return false
      }
      pendingSaveRef.current = null
      setActiveSession(updated)
      setElapsedSeconds(Math.floor(newDurationSec))
      setTimerStatus('paused')
      setSaveErrorMessage(null)
      return true
    } finally {
      isPersistingRef.current = false
    }
  }, [activeSession, persistActiveSession])

  // Action: Update task note or the idle task draft.
  const updateTaskNote = useCallback(async (note: string): Promise<boolean> => {
    if (!activeSession) {
      setTaskNoteDraft(note)
      setSaveErrorMessage(null)
      return true
    }
    if (isSavingRef.current || isPersistingRef.current) return false
    isPersistingRef.current = true
    const updated: ActiveSession = { ...activeSession, taskNote: note }

    try {
      if (!(await persistActiveSession(updated, activeSession))) {
        setSaveErrorMessage("Couldn't save your changes. Your session is kept.")
        return false
      }
      pendingSaveRef.current = null
      setActiveSession(updated)
      setSaveErrorMessage(null)
      return true
    } finally {
      isPersistingRef.current = false
    }
  }, [activeSession, persistActiveSession])

  // Action: Save session.
  const save = useCallback(async (simulateFailure: boolean = false): Promise<boolean> => {
    if (!activeSession || !agreement || isSavingRef.current || isPersistingRef.current) return false
    isSavingRef.current = true
    clearSavedTimeout()
    setTimerStatus('saving')
    setSaveErrorMessage(null)
    let savedSuccessfully = false

    let pending = pendingSaveRef.current
    if (!pending || pending.record.id !== activeSession.id) {
      const finalSec = computeElapsedSeconds(activeSession)
      if (finalSec <= 0) {
        let cleared = false
        try {
          if (!(await persistActiveSession(null, activeSession))) {
            setTimerStatus(activeSession.status)
            setSaveErrorMessage("Couldn't clear your empty session. Your session is kept.")
            return false
          }
          setActiveSession(null)
          setTimerStatus('idle')
          cleared = true
          return true
        } finally {
          isSavingRef.current = false
          flushDeferredSession(cleared)
        }
      }

      const startedAt = new Date(activeSession.startedAt)
      const yyyy = startedAt.getFullYear()
      const mm = String(startedAt.getMonth() + 1).padStart(2, '0')
      const dd = String(startedAt.getDate()).padStart(2, '0')
      const frozenActiveSession: ActiveSession = {
        ...activeSession,
        activeDurationMs: finalSec * 1000,
        currentRunStartedAt: null,
        status: 'paused',
      }
      const { usdEarned, gbpCredit } = calculateSessionValues(
        finalSec,
        agreement.hourlyRateUSD,
        agreement.exchangeRateUSDToGBP
      )
      const record = Object.freeze({
        id: activeSession.id,
        agreementId: agreement.id,
        date: `${yyyy}-${mm}-${dd}`,
        startTime: startedAt.toTimeString().split(' ')[0],
        activeDurationSec: finalSec,
        taskNote: activeSession.taskNote.trim() || undefined,
        usdEarned,
        hourlyRateUSD: agreement.hourlyRateUSD,
        exchangeRate: agreement.exchangeRateUSDToGBP,
        gbpCredit,
        appliedGbp: 0,
        excessGbp: 0,
        createdAt: new Date().toISOString(),
      })
      pending = {
        record,
        activeSession: frozenActiveSession,
        expectedActiveSession: activeSession,
        activePersisted: false,
        persisted: false,
      }
      pendingSaveRef.current = pending
    }

    // Freeze the displayed timer immediately and require the frozen active state to persist first.
    setActiveSession(pending.activeSession)
    setElapsedSeconds(pending.activeSession.activeDurationMs / 1000)

    try {
      if (!pending.activePersisted) {
        if (!(await persistActiveSession(pending.activeSession, pending.expectedActiveSession))) {
          throw new Error('Failed to persist frozen active session')
        }
        pending = { ...pending, activePersisted: true }
        pendingSaveRef.current = pending
      }
      if (simulateFailure) throw new Error('Simulated save error')

      if (!pending.persisted) {
        const success = await onSaveSession(pending.record)
        if (!success) throw new Error('Session save was not confirmed')
        pending = { ...pending, persisted: true }
        pendingSaveRef.current = pending
      }

      // The server callback saves the record and clears activeSession atomically.
      // The local fallback still needs to clear the browser copy.
      if (!onPersistActiveSession && !(await persistActiveSession(null, pending.activeSession))) {
        throw new Error('Failed to clear the saved active session')
      }

      pendingSaveRef.current = null
      setActiveSession(null)
      const savedInfo = {
        duration: pending.record.activeDurationSec < 60
          ? `${pending.record.activeDurationSec}s`
          : `${Math.floor(pending.record.activeDurationSec / 60)}m`,
        gbpAmount: `£${pending.record.gbpCredit.toFixed(2)}`,
      }
      setLastSavedInfo(savedInfo)
      savedNoticeRef.current = true
      setTimerStatus('saved')
      savedTimeoutRef.current = setTimeout(() => {
        savedTimeoutRef.current = null
        savedNoticeRef.current = false
        setTimerStatus((current) => current === 'saved' ? 'idle' : current)
        setLastSavedInfo((current) => current === savedInfo ? null : current)
      }, 3200)
      savedSuccessfully = true
      return true
    } catch (err) {
      console.error('Save failed:', err)
      setTimerStatus('save_failed')
      setSaveErrorMessage(pending.persisted
        ? "Saved, but couldn't clear the active timer. Retry to finish."
        : pending.activePersisted
          ? "Couldn't save. Your time is kept."
          : "Couldn't save locally. Your time is kept in this tab.")
      return false
    } finally {
      isSavingRef.current = false
      flushDeferredSession(savedSuccessfully === true)
    }
  }, [
    activeSession,
    agreement,
    clearSavedTimeout,
    computeElapsedSeconds,
    flushDeferredSession,
    onPersistActiveSession,
    onSaveSession,
    persistActiveSession,
  ])

  // Action: Retry save; the pending record remains fixed until an explicit edit or resume.
  const retrySave = useCallback(() => save(false), [save])

  return {
    activeSession,
    taskNoteDraft,
    elapsedSeconds,
    timerStatus,
    lastSavedInfo,
    saveErrorMessage,
    clockIn,
    pause,
    resume,
    save,
    retrySave,
    correctTime,
    updateTaskNote,
  }
}
