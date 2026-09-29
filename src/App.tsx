import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import confetti from 'canvas-confetti'
import { Header } from './components/Header'
import { DebtHero } from './components/DebtHero'
import { TimerSection } from './components/TimerSection'
import { SupportingTotals } from './components/SupportingTotals'
import { SessionHistory } from './components/SessionHistory'
import { CompactTimerDock } from './components/CompactTimerDock'
import { SetupSheet } from './components/SetupSheet'
import { AddTimeSheet } from './components/AddTimeSheet'
import { SessionDetailSheet } from './components/SessionDetailSheet'
import { CurrentSessionSheet } from './components/CurrentSessionSheet'
import { SettingsSheet } from './components/SettingsSheet'
import type { Agreement, WorkSession, AppSettings } from './types'
import {
  loadAgreement,
  saveAgreement,
  loadSessions,
  saveSessions,
  loadSettings,
  saveSettings,
  loadArchives,
  saveArchives,
  subscribeToSync,
} from './utils/storage'
import {
  recalculateSessions,
  calculateProjectedSummary,
} from './utils/calculations'
import { useClockedTimer } from './hooks/useClockedTimer'

export function App() {
  // State
  const [agreement, setAgreement] = useState<Agreement | null>(() => loadAgreement())
  const [sessions, setSessions] = useState<WorkSession[]>(() => loadSessions())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  // Sheets modal state
  const [isSetupOpen, setIsSetupOpen] = useState<boolean>(() => !loadAgreement())
  const [isAddTimeOpen, setIsAddTimeOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCurrentSessionSheetOpen, setIsCurrentSessionSheetOpen] = useState(false)
  const [selectedSessionForDetail, setSelectedSessionForDetail] = useState<WorkSession | null>(null)

  // Intersection observer state for CompactTimerDock
  const [isTimerDockVisible, setIsTimerDockVisible] = useState(false)
  const timerSectionRef = useRef<HTMLDivElement>(null)

  // Recalculate saved sessions mathematically
  const { recalculatedSessions, summary: savedSummary } = useMemo(() => {
    if (!agreement) {
      return {
        recalculatedSessions: [],
        summary: {
          totalSavedSeconds: 0,
          totalUsdEarned: 0,
          totalGbpCredit: 0,
          totalCreditApplied: 0,
          remainingDebt: 60,
          excessGbp: 0,
          isAllSquare: false,
          isLessThanOnePenny: false,
          projectedRemaining: 60,
          projectedCredit: 0,
          projectedExcess: 0,
          projectedSeconds: 0,
          estimatedSecondsRemaining: 45000,
          marksCleared: 0,
          marksTotal: 60,
        },
      }
    }
    return recalculateSessions(sessions, agreement)
  }, [sessions, agreement])

  // Trigger celebration once when debt reaches 0 upon saving
  const triggerCelebration = useCallback(() => {
    // Restrained, tasteful burst with violet and white
    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.4 },
        colors: ['#B6A0E9', '#F5F2F8', '#ABA6B5'],
        disableForReducedMotion: true,
      })
    } catch (e) {
      console.warn('Confetti unavailable:', e)
    }
  }, [])

  // Save session handler
  const handleSaveSessionFromTimer = useCallback(
    async (newSession: WorkSession): Promise<boolean> => {
      if (!agreement) return false

      const updatedList = [newSession, ...sessions]
      // Verify calculation
      const { summary: newSummary } = recalculateSessions(updatedList, agreement)
      const success = saveSessions(updatedList)

      if (success) {
        setSessions(updatedList)

        // Check if this save pushed the agreement to completion
        if (newSummary.isAllSquare && !agreement.completedAt) {
          const completedAgreement: Agreement = {
            ...agreement,
            completedAt: new Date().toISOString(),
          }
          saveAgreement(completedAgreement)
          setAgreement(completedAgreement)
          triggerCelebration()
        }
        return true
      }
      return false
    },
    [agreement, sessions, triggerCelebration]
  )

  // Timer hook
  const {
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
  } = useClockedTimer({
    agreement,
    onSaveSession: handleSaveSessionFromTimer,
  })

  // Synchronize across tabs
  useEffect(() => {
    const unsub = subscribeToSync((message) => {
      if (message.type === 'SESSIONS_UPDATE') {
        setSessions(message.sessions)
      } else if (message.type === 'AGREEMENT_UPDATE') {
        setAgreement(message.agreement)
      }
    })
    return unsub
  }, [])

  // Projected summary accounting for running / paused session
  const activeSummary = useMemo(() => {
    if (!agreement) return savedSummary
    if (timerStatus === 'running' || timerStatus === 'paused') {
      return calculateProjectedSummary(savedSummary, elapsedSeconds, agreement)
    }
    return savedSummary
  }, [agreement, savedSummary, timerStatus, elapsedSeconds])

  // Observer for compact timer dock
  useEffect(() => {
    const element = document.getElementById('main-timer-section')
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        // If main timer is NOT intersecting (scrolled above viewport) and timer is active
        const isOffScreen = !entry.isIntersecting && entry.boundingClientRect.top < 0
        const isSessionRunningOrPaused = timerStatus === 'running' || timerStatus === 'paused'
        setIsTimerDockVisible(isOffScreen && isSessionRunningOrPaused)
      },
      {
        threshold: 0.1,
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [timerStatus])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if focus is in an input or textarea or modal is open
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return
      }
      if (isSetupOpen || isAddTimeOpen || isSettingsOpen || isCurrentSessionSheetOpen || selectedSessionForDetail) {
        return
      }

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault()
        if (timerStatus === 'idle') {
          clockIn()
        } else if (timerStatus === 'running') {
          pause()
        } else if (timerStatus === 'paused') {
          resume()
        }
      } else if (e.key === 's') {
        if (timerStatus === 'running' || timerStatus === 'paused') {
          e.preventDefault()
          save()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    timerStatus,
    clockIn,
    pause,
    resume,
    save,
    isSetupOpen,
    isAddTimeOpen,
    isSettingsOpen,
    isCurrentSessionSheetOpen,
    selectedSessionForDetail,
  ])

  // Save manual session from AddTimeSheet
  const handleSaveManualSession = (newSession: WorkSession) => {
    if (!agreement) return
    const updated = [newSession, ...sessions]
    const { summary: newSummary } = recalculateSessions(updated, agreement)
    saveSessions(updated)
    setSessions(updated)

    if (newSummary.isAllSquare && !agreement.completedAt) {
      const completed: Agreement = {
        ...agreement,
        completedAt: new Date().toISOString(),
      }
      saveAgreement(completed)
      setAgreement(completed)
      triggerCelebration()
    }
  }

  // Update session from detail sheet
  const handleUpdateSession = (updatedSession: WorkSession) => {
    if (!agreement) return
    const updated = sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    saveSessions(updated)
    setSessions(updated)
  }

  // Delete session from detail sheet
  const handleDeleteSession = (sessionId: string) => {
    if (!agreement) return
    const updated = sessions.filter((s) => s.id !== sessionId)
    saveSessions(updated)
    setSessions(updated)

    // If debt is reopened, clear completedAt
    const { summary: newSummary } = recalculateSessions(updated, agreement)
    if (!newSummary.isAllSquare && agreement.completedAt) {
      const reopened = { ...agreement, completedAt: null }
      saveAgreement(reopened)
      setAgreement(reopened)
    }
  }

  // Archive and start new agreement
  const handleArchiveAndNew = () => {
    if (!agreement) return
    const currentArchives = loadArchives()
    const newArchives = [
      ...currentArchives,
      {
        agreement: { ...agreement, isArchived: true },
        sessions,
      },
    ]
    saveArchives(newArchives)
    saveSessions([])
    setSessions([])
    setAgreement(null)
    setIsSettingsOpen(false)
    setIsSetupOpen(true)
  }

  // Fallback initial agreement for presentation before setup completes
  const activeAgreement = useMemo(() => {
    return (
      agreement || {
        id: 'placeholder',
        sisterName: '',
        originalDebtGBP: 60.0,
        hourlyRateUSD: 6.0,
        exchangeRateUSDToGBP: 0.8,
        exchangeRateSource: 'Controlled test rate',
        exchangeRateDate: '2026-09-29',
        createdAt: '2026-09-29T10:00:00.000Z',
      }
    )
  }, [agreement])

  const isSessionActive = timerStatus === 'running' || timerStatus === 'paused'

  return (
    <div className="min-h-screen bg-black text-[#F5F2F8] selection:bg-[#B6A0E9] selection:text-[#151019] flex flex-col items-center">
      {/* Container: Max ~1040px on desktop with 32px margins, 390px target on mobile */}
      <div className="w-full max-w-[1040px] px-5 sm:px-8 py-2 md:py-6 flex flex-col flex-1">
        {/* Header */}
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Desktop 2-column or Mobile 1-column layout */}
        <main className="w-full mt-4 lg:mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start flex-1">
          {/* LEFT COLUMN: Max ~560px on desktop (Debt reading -> Repayment marks -> Timer section -> Supporting totals) */}
          <div className="w-full max-w-[520px] lg:max-w-[560px] mx-auto lg:col-span-7 flex flex-col">
            {/* 1. Debt Section */}
            <DebtHero
              summary={activeSummary}
              agreement={activeAgreement}
              isSessionActive={isSessionActive}
            />

            {/* 2. Timer Section */}
            <div ref={timerSectionRef} className="w-full">
              <TimerSection
                timerStatus={timerStatus}
                activeSession={activeSession}
                elapsedSeconds={elapsedSeconds}
                agreement={activeAgreement}
                lastSavedInfo={lastSavedInfo}
                saveErrorMessage={saveErrorMessage}
                isAllSquareCompleted={savedSummary.isAllSquare}
                totalSessionsCount={recalculatedSessions.length}
                totalSavedSeconds={savedSummary.totalSavedSeconds}
                excessGbp={savedSummary.excessGbp}
                onClockIn={() => clockIn()}
                onPause={pause}
                onResume={resume}
                onSave={() => save(false)}
                onRetrySave={retrySave}
                onOpenCurrentSessionSheet={() => setIsCurrentSessionSheetOpen(true)}
                onOpenConversionDetails={() => setIsSettingsOpen(true)}
                onViewSessions={() => {
                  const historyEl = document.getElementById('session-history-container')
                  historyEl?.scrollIntoView({ behavior: 'smooth' })
                }}
              />
            </div>

            {/* 3. Supporting Totals (hidden when All Square completion summary is shown) */}
            {!(savedSummary.isAllSquare && !isSessionActive) && (
              <SupportingTotals
                totalSavedSeconds={savedSummary.totalSavedSeconds}
                estimatedSecondsRemaining={activeSummary.estimatedSecondsRemaining}
                isSessionActive={isSessionActive}
              />
            )}
          </div>

          {/* RIGHT COLUMN on desktop / BELOW ON MOBILE: Session History */}
          <div
            id="session-history-container"
            className="w-full max-w-[520px] lg:max-w-none mx-auto lg:col-span-5"
          >
            <SessionHistory
              sessions={recalculatedSessions}
              onOpenAddTime={() => setIsAddTimeOpen(true)}
              onSelectSession={(s) => setSelectedSessionForDetail(s)}
            />
          </div>
        </main>
      </div>

      {/* Mobile Compact Timer Dock */}
      <CompactTimerDock
        isVisible={isTimerDockVisible}
        timerStatus={timerStatus}
        elapsedSeconds={elapsedSeconds}
        onPause={pause}
        onResume={resume}
        onSave={() => save(false)}
      />

      {/* Sheets & Dialogs */}
      {isSetupOpen && (
        <SetupSheet
          isOpen={isSetupOpen}
          isFirstSetup={!agreement}
          initialAgreement={agreement}
          onClose={() => {
            if (agreement) setIsSetupOpen(false)
          }}
          onSaveAgreement={(newAg) => {
            saveAgreement(newAg)
            setAgreement(newAg)
            setIsSetupOpen(false)
          }}
        />
      )}

      {isAddTimeOpen && (
        <AddTimeSheet
          isOpen={isAddTimeOpen}
          onClose={() => setIsAddTimeOpen(false)}
          agreement={activeAgreement}
          onSaveSession={handleSaveManualSession}
        />
      )}

      {selectedSessionForDetail && (
        <SessionDetailSheet
          isOpen={!!selectedSessionForDetail}
          onClose={() => setSelectedSessionForDetail(null)}
          session={selectedSessionForDetail}
          agreement={activeAgreement}
          isCurrentSessionPending={isSessionActive}
          onUpdateSession={handleUpdateSession}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {isCurrentSessionSheetOpen && (
        <CurrentSessionSheet
          isOpen={isCurrentSessionSheetOpen}
          onClose={() => setIsCurrentSessionSheetOpen(false)}
          activeSession={activeSession}
          elapsedSeconds={elapsedSeconds}
          agreement={activeAgreement}
          onUpdateTaskNote={updateTaskNote}
          onCorrectTime={correctTime}
        />
      )}

      {isSettingsOpen && (
        <SettingsSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          agreement={activeAgreement}
          sessions={recalculatedSessions}
          settings={settings}
          onUpdateSettings={(newSettings) => {
            saveSettings(newSettings)
            setSettings(newSettings)
          }}
          onEditAgreement={() => {
            setIsSettingsOpen(false)
            setIsSetupOpen(true)
          }}
          onArchiveAndNewAgreement={handleArchiveAndNew}
          onRestoreComplete={() => {
            setAgreement(loadAgreement())
            setSessions(loadSessions())
          }}
        />
      )}
    </div>
  )
}
export default App
