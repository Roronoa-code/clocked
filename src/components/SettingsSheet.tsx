import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Archive, ChevronLeft, ChevronRight, Download, Upload } from 'lucide-react'
import type { Agreement, WorkSession, ActiveSession, AppSettings } from '../types'
import { downloadBackupFile, parseAndValidateBackup, type BackupData } from '../utils/storage'
import { ModalSheet } from './ModalSheet'
import { SetupSheet } from './SetupSheet'

type Route = 'root' | 'agreement' | 'edit' | 'records' | 'archive' | 'motion'
interface Props {
  isOpen: boolean
  onClose: () => void
  agreement: Agreement
  sessions: WorkSession[]
  activeSession: ActiveSession | null
  archives: { agreement: Agreement; sessions: WorkSession[] }[]
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => Promise<boolean>
  onSaveAgreement: (agreement: Agreement) => Promise<boolean>
  onArchiveAndNewAgreement: () => Promise<boolean>
  onRestoreBackup: (backup: BackupData) => Promise<boolean>
}

function historyRoute(): { route: Route; depth: number; archiveIndex?: number } | null {
  const value = window.history.state?.clockedSettings
  return value && typeof value.depth === 'number' ? value : null
}

export function SettingsSheet({ isOpen, onClose, agreement, sessions, activeSession, archives, settings,
  onUpdateSettings, onSaveAgreement, onArchiveAndNewAgreement, onRestoreBackup }: Props) {
  const [route, setRoute] = useState<Route>(() => historyRoute()?.route || 'root')
  const depth = useRef(historyRoute()?.depth || 0)
  const [editDirty, setEditDirty] = useState(false)
  const [showDiscard, setShowDiscard] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [selectedArchive, setSelectedArchive] = useState<number | null>(() => historyRoute()?.archiveIndex ?? null)
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const allowDirtyBack = useRef(false)
  const opened = useRef(false)
  const closing = useRef(false)

  useLayoutEffect(() => {
    if (!isOpen) { opened.current = false; closing.current = false; return }
    if (closing.current) return
    const current = historyRoute()
    if (!opened.current) {
      const next = { ...window.history.state, clockedSettings: { route: 'root', depth: current?.depth || 1 } }
      if (current) window.history.replaceState(next, '')
      else window.history.pushState(next, '')
      depth.current = current?.depth || 1
      setRoute('root')
      opened.current = true
    } else if (current) { depth.current = current.depth; setRoute(current.route) }
    const onPop = (event: PopStateEvent) => {
      if (closing.current) return
      const state = event.state?.clockedSettings
      if (route === 'edit' && editDirty && !allowDirtyBack.current && state?.route !== 'edit') {
        window.history.pushState({ ...window.history.state, clockedSettings: { route: 'edit', depth: depth.current } }, '')
        setShowDiscard(true)
        return
      }
      allowDirtyBack.current = false
      if (state) { depth.current = state.depth; setRoute(state.route); if (typeof state.archiveIndex === 'number') setSelectedArchive(state.archiveIndex) }
      else { depth.current = 0; opened.current = false; setRoute('root'); onClose() }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [isOpen, onClose, route, editDirty])

  const navigate = (next: Route, archiveIndex?: number) => {
    depth.current += 1
    window.history.pushState({ ...window.history.state, clockedSettings: { route: next, depth: depth.current, archiveIndex } }, '')
    setRoute(next)
    setMessage('')
  }
  const back = () => {
    if (route === 'edit' && editDirty) { setShowDiscard(true); return }
    window.history.back()
  }
  const close = useCallback(() => {
    const count = depth.current
    depth.current = 0
    closing.current = true
    opened.current = false
    if (count > 0) window.history.go(-count)
    setRoute('root')
    onClose()
  }, [onClose])

  const readFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setMessage('')
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseAndValidateBackup(String(reader.result || ''))
      if (result.valid && result.data) setPendingBackup(result.data)
      else setMessage(result.error || 'Invalid backup file.')
    }
    reader.onerror = () => setMessage('Could not read that file.')
    reader.readAsText(file)
  }

  const restore = async () => {
    if (!pendingBackup || busy) return
    setBusy(true)
    const success = await onRestoreBackup(pendingBackup)
    setBusy(false)
    if (success) { setPendingBackup(null); setMessage('Backup restored for both of you.'); close() }
    else setMessage('Could not save the backup. Shared records are unchanged.')
  }

  const archive = async () => {
    if (busy) return
    setBusy(true)
    const success = await onArchiveAndNewAgreement()
    setBusy(false)
    if (success) { setArchiveConfirm(false); close() }
    else setMessage(activeSession ? 'Save the active timer before archiving.' : 'Could not archive. Please try again.')
  }

  const title = route === 'root' ? 'Settings' : route === 'agreement' ? 'Agreement' : route === 'edit' ? 'Edit agreement'
    : route === 'records' ? 'Records & backup' : route === 'archive' ? 'Archived agreement' : 'Motion & access'
  const footer = route === 'edit' ? <button type="submit" form="settings-agreement-form" className="btn-base btn-violet w-full">Save agreement</button> : undefined

  return <ModalSheet isOpen={isOpen} onClose={close} title={title} hasUnsavedChanges={route === 'edit' && editDirty}
    footer={footer}>
    <div className="sheet-route space-y-5" key={route}>
      {route !== 'root' && <button type="button" onClick={back} className="inline-flex min-h-11 items-center gap-1 text-[14px] font-semibold text-[#B6A0E9] rounded-lg focus-visible:outline-2 focus-visible:outline-[#B6A0E9]"><ChevronLeft className="h-4 w-4" />Back</button>}

      {route === 'root' && <nav aria-label="Settings sections" className="divide-y divide-[#2D2B35]">
        {([['agreement', 'Agreement', 'Debt and hourly rate'], ['records', 'Records', 'Backup and archives'], ['motion', 'Motion', 'Display and keyboard']] as const).map(([to, label, detail]) =>
          <button key={to} type="button" onClick={() => navigate(to)} className="w-full min-h-[64px] flex items-center justify-between gap-3 text-left hover:text-[#B6A0E9] focus-visible:outline-2 focus-visible:outline-[#B6A0E9] rounded-lg">
            <span><strong className="block text-[15px]">{label}</strong><small className="block text-[12px] text-[#ABA6B5]">{detail}</small></span><ChevronRight className="h-4 w-4 shrink-0" />
          </button>)}
      </nav>}

      {route === 'agreement' && <div className="space-y-4">
        <div className="divide-y divide-[#2D2B35] text-[14px]">
          <Row label="Sister" value={agreement.sisterName || 'Not specified'} />
          <Row label="Original debt" value={`£${agreement.originalDebtGBP.toFixed(2)}`} />
          <Row label="Hourly credit" value={`US$${agreement.hourlyRateUSD}/hr`} />
          <Row label="Agreed exchange" value={`US$1 = £${agreement.exchangeRateUSDToGBP}`} />
          <Row label="Rate source" value={`${agreement.exchangeRateSource} · ${agreement.exchangeRateDate}`} />
        </div>
        <p className="text-[12px] text-[#ABA6B5]">Past work keeps the rate at which it was earned. Changes here apply to future work.</p>
        {activeSession && <p className="text-[12px] text-[#ABA6B5]">Save the current timer before changing this agreement.</p>}
        <button type="button" onClick={() => navigate('edit')} disabled={!!activeSession} className="btn-base btn-graphite w-full">Modify agreement</button>
      </div>}

      {route === 'edit' && <SetupSheet embedded formId="settings-agreement-form" isOpen={isOpen}
        initialAgreement={agreement} onDirtyChange={setEditDirty} onSaveAgreement={async next => {
          const success = await onSaveAgreement(next)
          if (success) { allowDirtyBack.current = true; setEditDirty(false); window.history.back() }
          return success
        }} />}

      {route === 'records' && <div className="space-y-5 text-[13px]">
        <p className="text-[#ABA6B5]">Records are saved online for both of you. Closing the browser or clearing its cache does not erase them.</p>
        <div className="border-t border-[#2D2B35] pt-4 flex items-center justify-between gap-3">
          <div><strong className="text-[14px]">Export backup</strong><p className="text-[#ABA6B5]">Download a copy of all records.</p></div>
          <button type="button" onClick={() => downloadBackupFile({ agreement, sessions, archives, activeSession })} className="btn-base btn-graphite h-11 px-3 text-[13px]"><Download className="h-4 w-4 mr-1" />Download</button>
        </div>
        <div className="border-t border-[#2D2B35] pt-4 flex items-center justify-between gap-3">
          <div><strong className="text-[14px]">Restore backup</strong><p className="text-[#ABA6B5]">Review before replacing shared records.</p></div>
          <label className="btn-base btn-graphite h-11 px-3 text-[13px]"><Upload className="h-4 w-4 mr-1" />Choose file<input type="file" accept=".json,application/json" onChange={readFile} className="sr-only" /></label>
        </div>
        {pendingBackup && <div className="border-y border-[#2D2B35] py-4 space-y-3">
          <p>Replace shared data with {pendingBackup.sessions.length} sessions and {pendingBackup.archives.length} archived agreements?</p>
          <div className="flex gap-2"><button type="button" onClick={() => setPendingBackup(null)} className="btn-base btn-graphite flex-1">Cancel</button><button type="button" onClick={() => void restore()} disabled={busy} className="btn-base btn-violet flex-1">{busy ? 'Restoring…' : 'Restore'}</button></div>
        </div>}
        {archives.length > 0 && <div className="border-t border-[#2D2B35] pt-4 space-y-2"><strong className="text-[14px]">Archived agreements</strong>{archives.map((entry, index) => <button key={`${entry.agreement.id}-${index}`} type="button" onClick={() => { setSelectedArchive(index); navigate('archive', index) }} className="w-full min-h-11 flex items-center justify-between gap-3 text-left text-[#F5F2F8] focus-visible:outline-2 focus-visible:outline-[#B6A0E9]"><span>{entry.agreement.sisterName || 'Agreement'}</span><span className="text-[#ABA6B5]">{entry.sessions.length} sessions <ChevronRight className="inline h-4 w-4" /></span></button>)}</div>}
        <div className="border-t border-[#2D2B35] pt-4">
          {!archiveConfirm ? <button type="button" onClick={() => setArchiveConfirm(true)} className="min-h-11 inline-flex items-center gap-2 text-[#ABA6B5] hover:text-[#F5F2F8]"><Archive className="h-4 w-4" />Archive agreement & start new</button>
            : <div className="space-y-3"><p>Archive this agreement and {sessions.length} sessions? Save any active timer first.</p><div className="flex gap-2"><button type="button" onClick={() => setArchiveConfirm(false)} className="btn-base btn-graphite flex-1">Cancel</button><button type="button" onClick={() => void archive()} disabled={busy} className="btn-base flex-1 bg-red-600 text-white">Archive</button></div></div>}
        </div>
      </div>}

      {route === 'archive' && selectedArchive !== null && archives[selectedArchive] && <div className="space-y-3 text-[14px]">
        <p className="text-[#ABA6B5]">Read-only archive</p>
        <Row label="Sister" value={archives[selectedArchive].agreement.sisterName} />
        <Row label="Original debt" value={`£${archives[selectedArchive].agreement.originalDebtGBP.toFixed(2)}`} />
        <Row label="Hourly credit" value={`US$${archives[selectedArchive].agreement.hourlyRateUSD}/hr`} />
        <Row label="Saved sessions" value={String(archives[selectedArchive].sessions.length)} />
        <div className="border-t border-[#2D2B35] pt-2 divide-y divide-[#2D2B35]">{archives[selectedArchive].sessions.map(item => <Row key={item.id} label={`${item.date} · ${item.taskNote || 'Work session'}`} value={`£${item.gbpCredit.toFixed(2)}`} />)}</div>
      </div>}

      {route === 'motion' && <div className="space-y-5">
        <fieldset><legend className="text-[14px] font-semibold mb-2">Reduced motion</legend><div className="grid grid-cols-3 gap-2">
          {(['system', true, false] as const).map(value => <button key={String(value)} type="button" aria-pressed={settings.reducedMotion === value}
            onClick={async () => { if (!await onUpdateSettings({ ...settings, reducedMotion: value })) setMessage('Could not save motion setting.') }}
            className={`min-h-11 rounded-lg border text-[13px] font-semibold ${settings.reducedMotion === value ? 'border-[#B6A0E9] bg-[#B6A0E9] text-[#151019]' : 'border-[#2D2B35] bg-[#24242d] text-[#ABA6B5]'}`}>
            {value === 'system' ? 'System' : value ? 'On' : 'Off'}
          </button>)}
        </div></fieldset>
        <div className="border-t border-[#2D2B35] pt-4 text-[12px] text-[#ABA6B5]"><strong className="block mb-2 text-[13px] text-[#F5F2F8]">Keyboard shortcuts</strong><p>Space or K: clock in, pause or resume · S: save · Esc: close a sheet</p></div>
      </div>}

      {message && <p role="alert" className="text-[13px] text-[#F5F2F8]">{message}</p>}
      {showDiscard && <div className="border-t border-[#2D2B35] pt-4 space-y-3 text-[13px]"><p>Discard changes to this agreement?</p><div className="flex gap-2"><button type="button" onClick={() => setShowDiscard(false)} className="btn-base btn-graphite flex-1">Keep editing</button><button type="button" onClick={() => { allowDirtyBack.current = true; setShowDiscard(false); setEditDirty(false); window.history.back() }} className="btn-base btn-offwhite flex-1">Discard</button></div></div>}
    </div>
  </ModalSheet>
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-3"><span className="text-[#ABA6B5]">{label}</span><span className="text-right text-[#F5F2F8] font-medium">{value}</span></div>
}
