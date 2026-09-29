import { Check, Pen } from 'lucide-react'
import type { Agreement, ActiveSession, ActiveSessionStatus } from '../types'
import { calculateSessionValues, formatGBP, formatHMS, formatHoursMinutes } from '../utils/calculations'
import { TimerActions } from './TimerActions'

interface Props {
  timerStatus: ActiveSessionStatus
  activeSession: ActiveSession | null
  elapsedSeconds: number
  agreement: Agreement
  remainingDebt: number
  lastSavedInfo: { duration: string; gbpAmount: string } | null
  saveErrorMessage: string | null
  isAllSquareCompleted: boolean
  totalSessionsCount: number
  totalSavedSeconds: number
  excessGbp: number
  onClockIn: () => void
  onPause: () => void
  onResume: () => void
  onSave: () => void
  onRetrySave: () => void
  onOpenCurrentSessionSheet: () => void
  onOpenConversionDetails?: () => void
  onViewSessions?: () => void
}

export function TimerSection({ timerStatus, activeSession, elapsedSeconds, agreement, remainingDebt,
  lastSavedInfo, saveErrorMessage, isAllSquareCompleted, totalSessionsCount, totalSavedSeconds,
  excessGbp, onClockIn, onPause, onResume, onSave, onRetrySave,
  onOpenCurrentSessionSheet, onOpenConversionDetails, onViewSessions }: Props) {
  const completed = isAllSquareCompleted && !activeSession && timerStatus !== 'saving' && timerStatus !== 'save_failed'
  const { gbpCredit } = calculateSessionValues(elapsedSeconds, agreement.hourlyRateUSD, agreement.exchangeRateUSDToGBP)
  const applied = Math.min(gbpCredit, remainingDebt)
  const targetReached = !!activeSession && remainingDebt > 0 && gbpCredit >= remainingDebt
  const statusText = saveErrorMessage || (timerStatus === 'saving' ? 'Saving this time…' : timerStatus === 'save_failed' ? 'Save failed · Time kept' :
    lastSavedInfo ? `Saved · ${lastSavedInfo.duration}` : targetReached ? 'Target reached · Save to finish' :
    timerStatus === 'running' ? 'Working' : timerStatus === 'paused' ? 'Paused' : 'Ready')
  const convertedHourly = agreement.hourlyRateUSD * agreement.exchangeRateUSDToGBP
  const task = activeSession?.taskNote?.trim()

  return (
    <section id="main-timer-section" data-status={timerStatus} className={`timer-footprint w-full rounded-[20px] border border-[#2D2B35] bg-[#111114] p-4 select-none ${completed ? 'timer-footprint-complete' : ''}`}>
      <div className="timer-live" aria-hidden={completed} inert={completed}>
      <div className="min-h-6 flex items-start justify-between gap-2">
        <span className={`timer-status text-[12px] leading-5 ${saveErrorMessage ? 'text-red-300' : targetReached || lastSavedInfo ? 'text-[#C8B3F2] font-semibold' : 'text-[#ABA6B5]'}`} role="status">
          <span className="status-light" aria-hidden="true" />{statusText}
        </span>
        <button type="button" onClick={onOpenCurrentSessionSheet} className="inline-flex min-h-11 -my-2 items-center gap-1.5 rounded-lg px-2 text-[13px] text-[#ABA6B5] hover:text-white focus-visible:outline-2 focus-visible:outline-[#B6A0E9] max-w-[45%]">
          <span className="truncate">{task || '+ Add task'}</span>{task && <Pen className="h-3.5 w-3.5 shrink-0" />}
        </button>
      </div>
      <div className="timer-display">
        <div className="timer-emblem" data-saved={!!lastSavedInfo} aria-hidden="true">
          <span className="saved-stamp"><Check size={25} strokeWidth={2.5} /></span>
            <svg className="session-clock" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeOpacity=".22" />
              {Array.from({ length: 12 }, (_, i) => <line key={i} x1="28" y1="6" x2="28" y2={i % 3 === 0 ? 11 : 8} transform={`rotate(${i * 30} 28 28)`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={i % 3 === 0 ? .9 : .4} />)}
              <line x1="28" y1="28" x2="28" y2="15" transform={`rotate(${elapsedSeconds % 60 * 6} 28 28)`} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="28" cy="28" r="3" fill="currentColor" />
            </svg>
        </div>
        <div className="timer-reading" role="timer" aria-live="off">{formatHMS(elapsedSeconds)}</div>
      </div>
      <div className="timer-credit">{lastSavedInfo ? 'Time saved to sessions' : `${formatGBP(applied, { allowLessThanPenny: true })} off this session`}</div>
      <div id="timer-action-region"><TimerActions status={timerStatus} onClockIn={onClockIn} onPause={onPause} onResume={onResume} onSave={onSave} onRetrySave={onRetrySave} /></div>
      <div className="mt-4 text-center">
        {onOpenConversionDetails ? <button type="button" onClick={onOpenConversionDetails} className="min-h-11 -my-2 px-2 text-[13px] text-[#938D9F] hover:text-[#F5F2F8] focus-visible:outline-2 focus-visible:outline-[#B6A0E9] rounded-lg" aria-label={`Hourly rate: US$${agreement.hourlyRateUSD} per hour, about £${convertedHourly.toFixed(2)} per hour. View conversion details.`}>
          US${agreement.hourlyRateUSD}/hr · £{convertedHourly.toFixed(2)}/hr
        </button> : <span className="text-[13px] text-[#938D9F]">US${agreement.hourlyRateUSD}/hr · £{convertedHourly.toFixed(2)}/hr</span>}
      </div>
      </div>
      <div className="timer-done" aria-hidden={!completed} inert={!completed}>
        <div className="min-h-[213px] flex flex-col justify-center text-center">
          <span className="completion-stamp" aria-hidden="true"><Check size={28} strokeWidth={2.5} /></span>
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#B6A0E9]">£0 remaining</p>
          <h2 className="mt-3 text-[23px] font-semibold">Debt cleared</h2>
          <p className="mt-2 text-[14px] text-[#ABA6B5]">{formatHoursMinutes(totalSavedSeconds)} worked across {totalSessionsCount} {totalSessionsCount === 1 ? 'session' : 'sessions'}.</p>
          {excessGbp > 0 && <p className="mt-1 text-[13px] text-[#ABA6B5]">Extra work preserved: {formatGBP(excessGbp, { allowLessThanPenny: true })}</p>}
          {onViewSessions && <button type="button" onClick={onViewSessions} className="mt-5 mx-auto min-h-11 px-4 text-[14px] font-semibold text-[#B6A0E9] hover:text-white focus-visible:outline-2 focus-visible:outline-[#B6A0E9] rounded-lg">View sessions</button>}
        </div>
      </div>
    </section>
  )
}
