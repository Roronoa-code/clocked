import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PinGate } from './components/PinGate'
import { ModalSheet } from './components/ModalSheet'
import type { Agreement, WorkSession, ActiveSession } from './types'
import type { BackupData } from './utils/storage'
import { loadAgreement, loadSessions, loadArchives, loadActiveSession, loadSettings } from './utils/storage'
import { recalculateSessions, calculateProjectedSummary } from './utils/calculations'
import { validateClockedData, type ClockedData } from './utils/validateState'
import { useClockedTimer } from './hooks/useClockedTimer'
import { useRemoteClocked } from './hooks/useRemoteClocked'

const placeholder: Agreement = {
  id: 'placeholder', sisterName: '', originalDebtGBP: 60, hourlyRateUSD: 6,
  exchangeRateUSDToGBP: 0.8, exchangeRateSource: 'Awaiting agreement',
  exchangeRateDate: '2026-09-29', createdAt: '2026-09-29T10:00:00.000Z',
}
const legacyStorageKeys = ['clocked_v1_agreement', 'clocked_v1_sessions', 'clocked_v1_active_session', 'clocked_v1_archives', 'clocked_v1_settings']

function downloadUnparsedLegacyData(): boolean {
  try {
    const records = Object.fromEntries(legacyStorageKeys.map(key => [key, localStorage.getItem(key)]))
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'clocked-old-browser-data.json'
    link.click()
    URL.revokeObjectURL(url)
    return true
  } catch { return false }
}

function legacyData(): ClockedData | null {
  const agreement = loadAgreement()
  if (!agreement) return null
  const normalized = { ...agreement }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.exchangeRateDate)) {
    const parsed = Date.parse(normalized.exchangeRateDate)
    if (Number.isFinite(parsed)) normalized.exchangeRateDate = new Date(parsed).toISOString().slice(0, 10)
  }
  const archives = loadArchives().map(entry => {
    const archived = { ...entry.agreement }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(archived.exchangeRateDate)) {
      const parsed = Date.parse(archived.exchangeRateDate)
      if (Number.isFinite(parsed)) archived.exchangeRateDate = new Date(parsed).toISOString().slice(0, 10)
    }
    return { agreement: archived, sessions: entry.sessions }
  })
  const oldActive = loadActiveSession()
  const data: ClockedData = {
    agreement: normalized, sessions: loadSessions(), archives,
    activeSession: oldActive?.status === 'running'
      ? { ...oldActive, status: 'paused', currentRunStartedAt: null }
      : oldActive,
    settings: loadSettings(),
  }
  return validateClockedData(data) ? data : null
}

function settleAgreement(agreement: Agreement, sessions: WorkSession[]): Agreement {
  const complete = recalculateSessions(sessions, agreement).summary.isAllSquare
  return { ...agreement, completedAt: complete ? agreement.completedAt || new Date().toISOString() : null }
}

function sameActive(a: ActiveSession | null, b: ActiveSession | null): boolean {
  return a === b || !!a && !!b && a.id === b.id && a.agreementId === b.agreementId
    && a.startedAt === b.startedAt && a.activeDurationMs === b.activeDurationMs
    && a.currentRunStartedAt === b.currentRunStartedAt && a.status === b.status && a.taskNote === b.taskNote
}

export function App() {
  const { party, snapshot, error, login, logout, refresh, commit } = useRemoteClocked()
  const data = snapshot?.data
  const agreement = data?.agreement ?? null
  const sessions = data?.sessions ?? []
  const settings = data?.settings ?? { reducedMotion: 'system', showExcessDetails: true }
  const [setupEditing, setSetupEditing] = useState(false)
  const [isAddTimeOpen, setIsAddTimeOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isCurrentSessionSheetOpen, setIsCurrentSessionSheetOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<WorkSession | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isTimerDockVisible, setIsTimerDockVisible] = useState(false)
  const [legacyChoiceDismissed, setLegacyChoiceDismissed] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [systemReduced, setSystemReduced] = useState(false)
  const legacy = useMemo(() => legacyData(), [])
  const legacyPresent = useMemo(() => {
    try { return legacyStorageKeys.slice(0, 4).some(key => localStorage.getItem(key) !== null) }
    catch { return true }
  }, [])
  const showLegacyChoice = !!snapshot && !agreement && sessions.length === 0
    && snapshot.data.archives.length === 0 && !!legacy && !legacyChoiceDismissed
  const showLegacyProblem = !!snapshot && !agreement && sessions.length === 0
    && snapshot.data.archives.length === 0 && legacyPresent && !legacy && !legacyChoiceDismissed
  const isSetupOpen = party === 'abdul' && !!snapshot && !showLegacyChoice && !showLegacyProblem && (setupEditing || !agreement)
  const motionReduced = settings.reducedMotion === true || settings.reducedMotion === 'system' && systemReduced

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = motionReduced ? 'true' : 'false'
  }, [motionReduced])

  const persistActive = useCallback((next: ActiveSession | null, expected: ActiveSession | null) => commit(current => {
    if (!sameActive(current.activeSession, expected)) return null
    if (next && (!current.agreement || next.agreementId !== current.agreement.id)) return null
    if (next && current.activeSession && current.activeSession.id !== next.id) return null
    return { ...current, activeSession: next }
  }), [commit])

  const saveTimerSession = useCallback(async (newSession: WorkSession): Promise<boolean> => {
    return commit(current => {
      if (!current.agreement || newSession.agreementId !== current.agreement.id) return null
      if (current.sessions.some(item => item.id === newSession.id)) return current
      if (current.activeSession?.id !== newSession.id) return null
      const nextSessions = [newSession, ...current.sessions]
      const nextAgreement = settleAgreement(current.agreement, nextSessions)
      return { ...current, sessions: nextSessions, agreement: nextAgreement, activeSession: null }
    })
  }, [commit])

  const {
    activeSession, elapsedSeconds, timerStatus, lastSavedInfo, saveErrorMessage,
    clockIn, pause, resume, save, retrySave, correctTime, updateTaskNote, taskNoteDraft,
  } = useClockedTimer({
    agreement, initialActiveSession: data?.activeSession ?? null,
    onPersistActiveSession: persistActive, onSaveSession: saveTimerSession,
  })

  const { recalculatedSessions, summary: savedSummary } = useMemo(() =>
    recalculateSessions(sessions, agreement ?? placeholder), [sessions, agreement])
  const activeSummary = useMemo(() => {
    if (!agreement || !activeSession) return savedSummary
    return calculateProjectedSummary(savedSummary, elapsedSeconds, agreement)
  }, [agreement, activeSession, savedSummary, elapsedSeconds])

  useEffect(() => {
    const element = document.getElementById('timer-action-region')
    if (!element) return
    let visible = false
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const bottom = element.getBoundingClientRect().bottom
        if (!activeSession) visible = false
        else if (!visible && bottom < -24) visible = true
        else if (visible && bottom > 8) visible = false
        setIsTimerDockVisible(visible)
      })
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [activeSession])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, button, [contenteditable="true"], [role="textbox"]')) return
      if (isSetupOpen || isAddTimeOpen || isSettingsOpen || isCurrentSessionSheetOpen || isDetailOpen || showLegacyChoice || showLegacyProblem) return
      if (event.code === 'Space' || event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (timerStatus === 'idle' || timerStatus === 'saved') void clockIn()
        else if (timerStatus === 'running') void pause()
        else if (timerStatus === 'paused') void resume()
      } else if (event.key.toLowerCase() === 's' && (timerStatus === 'running' || timerStatus === 'paused')) {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isSetupOpen, isAddTimeOpen, isSettingsOpen, isCurrentSessionSheetOpen, isDetailOpen, showLegacyChoice, showLegacyProblem, timerStatus, clockIn, pause, resume, save])

  const saveManual = useCallback(async (newSession: WorkSession) => {
    return commit(current => {
      if (!current.agreement || current.agreement.id !== newSession.agreementId
        || current.agreement.hourlyRateUSD !== newSession.hourlyRateUSD
        || current.agreement.exchangeRateUSDToGBP !== newSession.exchangeRate
        || current.sessions.some(item => item.id === newSession.id)) return null
      const nextSessions = [newSession, ...current.sessions]
      const nextAgreement = settleAgreement(current.agreement, nextSessions)
      return { ...current, sessions: nextSessions, agreement: nextAgreement }
    })
  }, [commit])

  const updateSession = useCallback((updated: WorkSession) => commit(current => {
    if (!current.agreement || current.activeSession || !current.sessions.some(item => item.id === updated.id)) return null
    const nextSessions = current.sessions.map(item => item.id === updated.id ? updated : item)
    return { ...current, sessions: nextSessions, agreement: settleAgreement(current.agreement, nextSessions) }
  }), [commit])

  const deleteSession = useCallback((id: string) => commit(current => {
    if (!current.agreement || current.activeSession || !current.sessions.some(item => item.id === id)) return null
    const nextSessions = current.sessions.filter(item => item.id !== id)
    return { ...current, sessions: nextSessions, agreement: settleAgreement(current.agreement, nextSessions) }
  }), [commit])

  const saveAgreement = useCallback((next: Agreement) => commit(current => current.activeSession ? null : ({
    ...current,
    agreement: settleAgreement({ ...next, completedAt: current.agreement?.completedAt }, current.sessions),
  })), [commit])

  const archive = useCallback(async () => {
    const success = await commit(current => {
      if (!current.agreement || current.activeSession) return null
      return { ...current,
        archives: [...current.archives, { agreement: { ...current.agreement, isArchived: true }, sessions: current.sessions }],
        agreement: null, sessions: [], activeSession: null,
      }
    })
    if (success) { setIsSettingsOpen(false); setSetupEditing(false) }
    return success
  }, [commit])

  const restore = useCallback(async (backup: BackupData) => {
    const active = backup.activeSession
    const frozen: ActiveSession | null = active?.status === 'running' ? {
      ...active, status: 'paused', currentRunStartedAt: null,
      activeDurationMs: active.activeDurationMs + Math.max(0, Date.parse(backup.exportedAt) - (active.currentRunStartedAt || Date.parse(backup.exportedAt))),
    } : active
    const success = await commit(current => ({
      ...current, agreement: backup.agreement, sessions: backup.sessions,
      archives: backup.archives, activeSession: frozen,
    }))
    if (success) { setSetupEditing(false); setIsSettingsOpen(false) }
    return success
  }, [commit])

  const importLegacy = useCallback(async () => {
    if (!legacy) return
    const success = await commit(current => {
      if (current.agreement || current.sessions.length || current.archives.length) return null
      return legacy
    })
    if (success) setLegacyChoiceDismissed(true)
    else setImportError('Could not import this browser’s records. They remain here; try again.')
  }, [legacy, commit])

  if (party === undefined) return <div className="min-h-screen bg-black text-[#ABA6B5] grid place-items-center p-5 text-center"><div>{error || 'Opening Clocked…'}{error && <button type="button" onClick={() => window.location.reload()} className="block mx-auto mt-4 text-[#B6A0E9]">Retry</button>}</div></div>
  if (!party) return <PinGate onSignIn={login} />
  if (!snapshot) return <div className="min-h-screen bg-black text-[#ABA6B5] grid place-items-center p-5 text-center"><div>{error || 'Loading shared records…'}{error && <button type="button" onClick={() => void refresh()} className="block mx-auto mt-4 text-[#B6A0E9]">Retry</button>}</div></div>
  if (party === 'daremo' && !agreement) return <div className="min-h-screen bg-black text-[#F5F2F8] px-5"><div className="mx-auto max-w-[1040px]"><Header party={party} onSignOut={() => void logout()} /><main className="mt-12 text-sm text-[#ABA6B5]">Abdul has not set an agreement yet.</main></div></div>

  const activeAgreement = agreement ?? placeholder
  const isSessionActive = !!activeSession

  return (
    <div data-reduced-motion={motionReduced ? 'true' : 'false'} className="min-h-screen bg-black text-[#F5F2F8] selection:bg-[#B6A0E9] selection:text-[#151019] flex flex-col items-center">
      <div className="w-full max-w-[1040px] px-5 sm:px-8 py-2 md:py-6 flex flex-col flex-1" style={isTimerDockVisible ? { paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' } : undefined}>
        <Header party={party} onSignOut={() => void logout()} onOpenSettings={party === 'abdul' ? () => setIsSettingsOpen(true) : undefined} />
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-800/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        <main className="w-full mt-4 min-[1280px]:mt-8 grid grid-cols-1 min-[1280px]:grid-cols-12 gap-8 min-[1280px]:gap-12 items-start flex-1">
          <div className="w-full max-w-[560px] mx-auto min-[1280px]:col-span-7 flex flex-col">
            <DebtHero summary={activeSummary} agreement={activeAgreement} isSessionActive={isSessionActive} />
            <TimerSection timerStatus={timerStatus} activeSession={activeSession} elapsedSeconds={elapsedSeconds}
              agreement={activeAgreement} remainingDebt={savedSummary.remainingDebt}
              lastSavedInfo={lastSavedInfo} saveErrorMessage={saveErrorMessage}
              isAllSquareCompleted={savedSummary.isAllSquare} totalSessionsCount={recalculatedSessions.length}
              totalSavedSeconds={savedSummary.totalSavedSeconds} excessGbp={savedSummary.excessGbp}
              onClockIn={() => void clockIn()} onPause={() => void pause()} onResume={() => void resume()}
              onSave={() => void save()} onRetrySave={() => void retrySave()}
              onOpenCurrentSessionSheet={() => setIsCurrentSessionSheetOpen(true)}
              onOpenConversionDetails={party === 'abdul' ? () => setIsSettingsOpen(true) : undefined}
              onViewSessions={() => document.getElementById('session-history-container')?.scrollIntoView({ behavior: motionReduced ? 'instant' : 'smooth' })}
            />
            {!(savedSummary.isAllSquare && !isSessionActive) && <SupportingTotals totalSavedSeconds={savedSummary.totalSavedSeconds}
              estimatedSecondsRemaining={activeSummary.estimatedSecondsRemaining} isSessionActive={isSessionActive} />}
          </div>
          <div id="session-history-container" className="w-full max-w-[560px] min-[1280px]:max-w-none mx-auto min-[1280px]:col-span-5">
            <SessionHistory sessions={recalculatedSessions} onOpenAddTime={() => setIsAddTimeOpen(true)}
              onSelectSession={item => { setSelectedSession(item); setIsDetailOpen(true) }} />
          </div>
        </main>
      </div>
      <CompactTimerDock isVisible={isTimerDockVisible && isSessionActive} timerStatus={timerStatus} elapsedSeconds={elapsedSeconds}
        onPause={() => void pause()} onResume={() => void resume()} onSave={() => void save()}
        onRetrySave={() => void retrySave()} />

      <SetupSheet key={agreement?.id ?? 'new'} isOpen={isSetupOpen} isFirstSetup={!agreement}
        initialAgreement={agreement} onClose={() => setSetupEditing(false)}
        onSaveAgreement={async next => {
          const success = await saveAgreement(next)
          if (success) setSetupEditing(false)
          return success
        }} />
      <AddTimeSheet isOpen={isAddTimeOpen} onClose={() => setIsAddTimeOpen(false)} agreement={activeAgreement}
        remainingDebt={savedSummary.remainingDebt} onSaveSession={saveManual} />
      <SessionDetailSheet isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} session={selectedSession}
        sessions={sessions} agreement={activeAgreement} isCurrentSessionPending={isSessionActive}
        onUpdateSession={updateSession} onDeleteSession={deleteSession} />
      <CurrentSessionSheet isOpen={isCurrentSessionSheetOpen} onClose={() => setIsCurrentSessionSheetOpen(false)}
        activeSession={activeSession} elapsedSeconds={elapsedSeconds} agreement={activeAgreement} taskNoteDraft={taskNoteDraft}
        onUpdateTaskNote={updateTaskNote} onCorrectTime={correctTime} />
      {party === 'abdul' && <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} agreement={activeAgreement}
        sessions={sessions} activeSession={activeSession} archives={snapshot.data.archives} settings={settings}
        onUpdateSettings={next => commit(current => ({ ...current, settings: next }))}
        onSaveAgreement={saveAgreement}
        onArchiveAndNewAgreement={archive} onRestoreBackup={restore} />}

      {legacy && <ModalSheet isOpen={showLegacyChoice} onClose={() => {}} canClose={false} title="Bring over this browser’s records?"
        footer={<div className="space-y-2"><button type="button" onClick={() => void importLegacy()} className="btn-base btn-violet w-full h-12">Import records</button>
          <button type="button" onClick={() => setLegacyChoiceDismissed(true)} className="btn-base btn-graphite w-full h-11">Start a fresh agreement</button></div>}>
        <p className="text-sm text-[#ABA6B5]">This browser has an agreement, {legacy.sessions.length} sessions and {legacy.archives.length} archives. Import them once so both of you can see the same countdown. Any old running timer will open paused for review.</p>
        {importError && <p role="alert" className="text-sm text-red-300">{importError}</p>}
      </ModalSheet>}
      {showLegacyProblem && <ModalSheet isOpen onClose={() => {}} canClose={false} title="Older records need repair"
        footer={<div className="space-y-2"><button type="button" onClick={() => { if (!downloadUnparsedLegacyData()) setImportError('This browser would not allow the download. Keep its data and try another browser setting.') }} className="btn-base btn-violet w-full">Download old data</button>
          <button type="button" onClick={() => setLegacyChoiceDismissed(true)} className="btn-base btn-graphite w-full">Continue without importing</button></div>}>
        <p className="text-sm text-[#ABA6B5]">This browser contains older Clocked records, but they could not be read safely. Download a copy before clearing browser data. Nothing has been added to the shared database.</p>
        {importError && <p role="alert" className="text-sm text-red-300">{importError}</p>}
      </ModalSheet>}
    </div>
  )
}

export default App
