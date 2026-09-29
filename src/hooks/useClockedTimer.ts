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
}

export function useClockedTimer({ agreement, onSaveSession }: UseClockedTimerProps) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(() => loadActiveSession())
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [timerStatus, setTimerStatus] = useState<ActiveSessionStatus>('idle')
  const [lastSavedInfo, setLastSavedInfo] = useState<{ duration: string; gbpAmount: string } | null>(null)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const isSavingRef = useRef(false)

  // Calculate current elapsed seconds from activeSession timestamps
  const computeElapsedSeconds = useCallback((session: ActiveSession | null): number => {
    if (!session) return 0
    let totalMs = session.activeDurationMs
    if (session.status === 'running' && session.currentRunStartedAt) {
      totalMs += Math.max(0, Date.now() - session.currentRunStartedAt)
    }
    return Math.floor(totalMs / 1000)
  }, [])

  // Sync elapsed seconds in state
  useEffect(() => {
    if (!activeSession) {
      setElapsedSeconds(0)
      if (timerStatus !== 'saved' && timerStatus !== 'save_failed') {
        setTimerStatus('idle')
      }
      return
    }

    setElapsedSeconds(computeElapsedSeconds(activeSession))
    if (activeSession.status === 'running') {
      setTimerStatus('running')
    } else if (activeSession.status === 'paused') {
      setTimerStatus('paused')
    }
  }, [activeSession, computeElapsedSeconds])

  // Ticking effect when running
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') return

    const interval = setInterval(() => {
      setElapsedSeconds(computeElapsedSeconds(activeSession))
    }, 200)

    return () => clearInterval(interval)
  }, [activeSession, computeElapsedSeconds])

  // Listen to multi-tab updates via BroadcastChannel
  useEffect(() => {
    const unsubscribe = subscribeToSync((message) => {
      if (message.type === 'ACTIVE_SESSION_UPDATE') {
        setActiveSession(message.activeSession)
      }
    })
    return unsubscribe
  }, [])

  // Action: Clock In
  const clockIn = useCallback(
    (initialTaskNote: string = '') => {
      if (!agreement) return
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
      saveActiveSession(newSession)
      setActiveSession(newSession)
      setTimerStatus('running')
      setSaveErrorMessage(null)
      setLastSavedInfo(null)
    },
    [agreement]
  )

  // Action: Pause
  const pause = useCallback(() => {
    if (!activeSession || activeSession.status !== 'running') return
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
    saveActiveSession(updated)
    setActiveSession(updated)
    setTimerStatus('paused')
  }, [activeSession])

  // Action: Resume
  const resume = useCallback(() => {
    if (!activeSession || activeSession.status !== 'paused') return
    const now = Date.now()
    const updated: ActiveSession = {
      ...activeSession,
      currentRunStartedAt: now,
      status: 'running',
    }
    saveActiveSession(updated)
    setActiveSession(updated)
    setTimerStatus('running')
    setSaveErrorMessage(null)
  }, [activeSession])

  // Action: Correct time (when paused)
  const correctTime = useCallback(
    (newDurationSec: number) => {
      if (!activeSession || activeSession.status !== 'paused') return
      const updated: ActiveSession = {
        ...activeSession,
        activeDurationMs: Math.max(0, newDurationSec * 1000),
        currentRunStartedAt: null,
      }
      saveActiveSession(updated)
      setActiveSession(updated)
      setElapsedSeconds(newDurationSec)
    },
    [activeSession]
  )

  // Action: Update task note
  const updateTaskNote = useCallback(
    (note: string) => {
      if (!activeSession) return
      const updated: ActiveSession = {
        ...activeSession,
        taskNote: note,
      }
      saveActiveSession(updated)
      setActiveSession(updated)
    },
    [activeSession]
  )

  // Action: Save session
  const save = useCallback(
    async (simulateFailure: boolean = false) => {
      if (!activeSession || !agreement || isSavingRef.current) return
      isSavingRef.current = true
      setTimerStatus('saving')
      setSaveErrorMessage(null)

      // Freeze exact elapsed time right now
      const finalSec = computeElapsedSeconds(activeSession)
      if (finalSec <= 0) {
        // Nothing to save
        saveActiveSession(null)
        setActiveSession(null)
        setTimerStatus('idle')
        isSavingRef.current = false
        return
      }

      const { usdEarned, gbpCredit } = calculateSessionValues(
        finalSec,
        agreement.hourlyRateUSD,
        agreement.exchangeRateUSDToGBP
      )

      const now = new Date()
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      const startTimeStr = now.toTimeString().split(' ')[0]

      const sessionRecord: WorkSession = {
        id: activeSession.id,
        agreementId: agreement.id,
        date: dateStr,
        startTime: startTimeStr,
        activeDurationSec: finalSec,
        taskNote: activeSession.taskNote.trim() || undefined,
        usdEarned,
        exchangeRate: agreement.exchangeRateUSDToGBP,
        gbpCredit,
        appliedGbp: 0, // will be calculated by recalculateSessions
        excessGbp: 0,
        createdAt: now.toISOString(),
      }

      try {
        if (simulateFailure) {
          throw new Error('Simulated save error')
        }

        const success = await onSaveSession(sessionRecord)
        if (success) {
          // Clear active session only upon confirmed success
          saveActiveSession(null)
          setActiveSession(null)
          setLastSavedInfo({
            duration: finalSec < 60 ? `${finalSec}s` : `${Math.floor(finalSec / 60)}m`,
            gbpAmount: `£${gbpCredit.toFixed(2)}`,
          })
          setTimerStatus('saved')

          // Return to Ready after brief acknowledgement (3 seconds)
          setTimeout(() => {
            setTimerStatus('idle')
            setLastSavedInfo(null)
          }, 3200)
        } else {
          setTimerStatus('save_failed')
          setSaveErrorMessage("Couldn't save. Your time is kept.")
        }
      } catch (err: any) {
        console.error('Save failed:', err)
        setTimerStatus('save_failed')
        setSaveErrorMessage("Couldn't save. Your time is kept.")
      } finally {
        isSavingRef.current = false
      }
    },
    [activeSession, agreement, computeElapsedSeconds, onSaveSession]
  )

  // Action: Retry save
  const retrySave = useCallback(() => {
    save(false)
  }, [save])

  return {
    activeSession,
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
