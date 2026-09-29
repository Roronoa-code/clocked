import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import type { Agreement, WorkSession } from '../types'
import { calculateSessionValues, formatGBP, formatHMS, formatUSD, recalculateSessions } from '../utils/calculations'
import { ModalSheet } from './ModalSheet'

type Route = 'detail' | 'edit' | 'delete'
interface Props {
  isOpen: boolean
  onClose: () => void
  session: WorkSession | null
  sessions: WorkSession[]
  agreement: Agreement
  isCurrentSessionPending: boolean
  onUpdateSession: (updated: WorkSession) => boolean | Promise<boolean>
  onDeleteSession: (id: string) => boolean | Promise<boolean>
}

export function SessionDetailSheet({ isOpen, onClose, session, sessions, agreement,
  isCurrentSessionPending, onUpdateSession, onDeleteSession }: Props) {
  const formId = useId()
  const [route, setRoute] = useState<Route>('detail')
  const [discardPrompt, setDiscardPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('0')
  const [seconds, setSeconds] = useState('0')
  const [task, setTask] = useState('')
  const depth = useRef(0)
  const allowDirtyBack = useRef(false)
  const opened = useRef(false)
  const closing = useRef(false)

  const duration = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
  const dirty = route === 'edit' && !!session && (date !== session.date || duration !== session.activeDurationSec || task !== (session.taskNote || ''))

  useLayoutEffect(() => {
    if (!isOpen || !session) { opened.current = false; closing.current = false; return }
    if (closing.current) return
    const existing = window.history.state?.clockedDetail
    if (!opened.current) {
      const next = { ...window.history.state, clockedDetail: { route: 'detail', depth: existing?.depth || 1 } }
      if (existing) window.history.replaceState(next, '')
      else window.history.pushState(next, '')
      depth.current = existing?.depth || 1
      setRoute('detail')
      opened.current = true
      closing.current = false
    } else if (existing) { depth.current = existing.depth; setRoute(existing.route) }
    const onPop = (event: PopStateEvent) => {
      if (closing.current) return
      const state = event.state?.clockedDetail
      if (route === 'edit' && dirty && !allowDirtyBack.current && state?.route !== 'edit') {
        window.history.pushState({ ...event.state, clockedDetail: { route: 'edit', depth: depth.current } }, '')
        setDiscardPrompt(true)
        return
      }
      allowDirtyBack.current = false
      if (state) { depth.current = state.depth; setRoute(state.route) }
      else { depth.current = 0; opened.current = false; setRoute('detail'); onClose() }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [isOpen, session, onClose, route, dirty])

  if (!session) return null
  const current = recalculateSessions(sessions, agreement)
  const currentSession = current.recalculatedSessions.find(item => item.id === session.id) || session
  const afterDelete = recalculateSessions(sessions.filter(item => item.id !== session.id), agreement)
  const restoredDebt = Math.max(0, afterDelete.summary.remainingDebt - current.summary.remainingDebt)
  const historicalRate = session.hourlyRateUSD ?? session.usdEarned * 3600 / session.activeDurationSec
  const editedValues = session.hourlyRateUSD
    ? calculateSessionValues(duration, historicalRate, session.exchangeRate)
    : duration === session.activeDurationSec
      ? { usdEarned: session.usdEarned, gbpCredit: session.gbpCredit }
      : { usdEarned: session.usdEarned * duration / session.activeDurationSec,
          gbpCredit: session.gbpCredit * duration / session.activeDurationSec }

  const edit = () => {
    setDate(session.date)
    setHours(String(Math.floor(session.activeDurationSec / 3600)))
    setMinutes(String(Math.floor(session.activeDurationSec % 3600 / 60)))
    setSeconds(String(session.activeDurationSec % 60))
    setTask(session.taskNote || '')
    setError('')
    navigate('edit')
  }
  const navigate = (next: Route) => {
    depth.current += 1
    window.history.pushState({ ...window.history.state, clockedDetail: { route: next, depth: depth.current } }, '')
    setRoute(next)
  }
  const close = () => {
    const count = depth.current
    depth.current = 0
    closing.current = true
    opened.current = false
    if (count > 0) window.history.go(-count)
    setRoute('detail'); setDiscardPrompt(false); setError(''); onClose()
  }
  const back = () => {
    if (dirty) setDiscardPrompt(true)
    else { window.history.back(); setError('') }
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!Number.isSafeInteger(duration) || duration <= 0 || duration > 360000) { setError('Enter a duration between 1 second and 100 hours.'); return }
    setBusy(true); setError('')
    const updated: WorkSession = {
      ...session, date, activeDurationSec: duration, taskNote: task.trim() || undefined,
      usdEarned: editedValues.usdEarned, gbpCredit: editedValues.gbpCredit,
      updatedAt: new Date().toISOString(),
    }
    try {
      if (await onUpdateSession(updated)) close()
      else setError('Could not save. Your edits are still here.')
    } catch { setError('Could not save. Your edits are still here.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    setBusy(true); setError('')
    try {
      if (await onDeleteSession(session.id)) close()
      else setError('Could not delete. The session is unchanged.')
    } catch { setError('Could not delete. The session is unchanged.') }
    finally { setBusy(false) }
  }

  const footer = discardPrompt ? <div key="discard" className="flex gap-3">
    <button type="button" onClick={() => setDiscardPrompt(false)} className="btn-base btn-graphite flex-1">Keep editing</button>
    <button type="button" onClick={event => { event.preventDefault(); allowDirtyBack.current = true; setDiscardPrompt(false); window.history.back() }} className="btn-base btn-offwhite flex-1">Discard</button>
  </div> : route === 'edit' ? <div key="edit" className="flex gap-3">
    <button type="button" onClick={back} disabled={busy} className="btn-base btn-graphite flex-1">Back</button>
    <button type="submit" form={formId} disabled={busy} className="btn-base btn-offwhite flex-1">{busy ? 'Saving…' : 'Save changes'}</button>
  </div> : route === 'delete' ? <div key="delete" className="flex gap-3">
    <button type="button" onClick={() => window.history.back()} disabled={busy} className="btn-base btn-graphite flex-1">Keep</button>
    <button type="button" onClick={() => void remove()} disabled={busy} className="btn-base flex-1 bg-red-600 text-white">{busy ? 'Deleting…' : 'Delete'}</button>
  </div> : isCurrentSessionPending ? undefined : <div key="detail" className="flex gap-3">
    <button type="button" onClick={edit} className="btn-base btn-graphite flex-1"><Edit3 className="h-4 w-4 mr-1" />Edit</button>
    <button type="button" onClick={() => { setError(''); navigate('delete') }} className="btn-base flex-1 text-red-300"><Trash2 className="h-4 w-4 mr-1" />Delete</button>
  </div>

  return <ModalSheet isOpen={isOpen} onClose={close} title={route === 'edit' ? 'Edit session' : route === 'delete' ? 'Delete session' : 'Session details'}
    hasUnsavedChanges={dirty} footer={footer}>
    <div className="sheet-route space-y-5" key={discardPrompt ? 'discard' : route}>
      {discardPrompt ? <p className="text-[14px]">Discard your unsaved edits to this session?</p> : route === 'edit' ?
        <form id={formId} onSubmit={save} className="space-y-5">
          <div><label htmlFor={`${formId}-date`} className="block mb-2 text-[13px] text-[#ABA6B5]">Date</label><input id={`${formId}-date`} type="date" required value={date} onChange={event => setDate(event.target.value)} className="input-base" /></div>
          <fieldset><legend className="mb-2 text-[13px] text-[#ABA6B5]">Duration</legend><div className="grid grid-cols-3 gap-2">
            {([['hours', hours, setHours, 999], ['minutes', minutes, setMinutes, 59], ['seconds', seconds, setSeconds, 59]] as const).map(([label, value, set, max]) =>
              <div key={label}><input id={`${formId}-${label}`} type="number" min="0" max={max} value={value} onChange={event => set(event.target.value)} className="input-base text-center tabular-nums" /><label htmlFor={`${formId}-${label}`} className="block mt-1 text-center text-[11px] text-[#938D9F] capitalize">{label}</label></div>)}
          </div></fieldset>
          <div><label htmlFor={`${formId}-task`} className="block mb-2 text-[13px] text-[#ABA6B5]">Task description</label><input id={`${formId}-task`} type="text" value={task} onChange={event => setTask(event.target.value)} className="input-base" /></div>
          <div className="border-t border-[#2D2B35] pt-4 text-[13px] text-[#ABA6B5]">Total work value <strong className="block mt-1 text-[23px] text-[#F5F2F8]">{formatGBP(editedValues.gbpCredit, { allowLessThanPenny: true })}</strong>{formatUSD(editedValues.usdEarned)} at locked exchange rate</div>
        </form> : route === 'delete' ?
        <div className="space-y-4 text-[14px]"><p>Delete “{session.taskNote || 'Work session'}” from {session.date}?</p><div className="border-y border-[#2D2B35] py-3 flex justify-between gap-3"><span className="text-[#ABA6B5]">Remaining debt would increase by</span><strong>{formatGBP(restoredDebt, { allowLessThanPenny: true })}</strong></div></div> :
        <div className="space-y-4"><div><h3 className="text-[20px] font-semibold break-words">{session.taskNote?.trim() || 'Work session'}</h3><p className="text-[13px] text-[#ABA6B5]">{session.date}{session.startTime ? ` at ${session.startTime}` : ''}</p></div>
          <div className="divide-y divide-[#2D2B35] text-[14px]">
            <Row label="Active duration" value={formatHMS(session.activeDurationSec)} />
            <Row label="USD earned" value={formatUSD(currentSession.usdEarned)} />
            <Row label="Locked exchange" value={`US$1 = £${session.exchangeRate}`} />
            <Row label="Total work value" value={formatGBP(currentSession.gbpCredit, { allowLessThanPenny: true })} />
            <Row label="Debt reduction" value={formatGBP(currentSession.appliedGbp, { allowLessThanPenny: true })} strong />
            {currentSession.excessGbp > 0 && <Row label="Extra work" value={formatGBP(currentSession.excessGbp, { allowLessThanPenny: true })} />}
          </div>
          {isCurrentSessionPending && <p className="text-[13px] text-[#ABA6B5]">Save the current timer before editing old work.</p>}
        </div>}
      {error && <p role="alert" className="text-[13px] text-red-300">{error}</p>}
    </div>
  </ModalSheet>
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex justify-between gap-4 py-3"><span className={strong ? 'text-[#F5F2F8] font-semibold' : 'text-[#ABA6B5]'}>{label}</span><span className={`text-right ${strong ? 'text-[#B6A0E9] font-bold' : 'text-[#F5F2F8]'}`}>{value}</span></div>
}
