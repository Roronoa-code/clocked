import React, { useId, useState } from 'react'
import { ModalSheet } from './ModalSheet'
import type { Agreement, WorkSession } from '../types'
import { calculateSessionValues, formatGBP, formatUSD } from '../utils/calculations'
import { DateField } from './DateField'

interface AddTimeSheetProps {
  isOpen: boolean
  onClose: () => void
  agreement: Agreement
  remainingDebt: number
  onSaveSession: (session: WorkSession) => boolean | Promise<boolean>
}

export const AddTimeSheet: React.FC<AddTimeSheetProps> = ({
  isOpen,
  onClose,
  agreement,
  remainingDebt,
  onSaveSession,
}) => {
  const formId = useId()
  const todayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`
  }

  const [date, setDate] = useState<string>(todayStr())
  const [hours, setHours] = useState<string>('0')
  const [minutes, setMinutes] = useState<string>('30')
  const [seconds, setSeconds] = useState<string>('0')
  const [taskNote, setTaskNote] = useState<string>('')
  const [durationError, setDurationError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const dirty = date !== todayStr() || hours !== '0' || minutes !== '30' || seconds !== '0' || taskNote !== ''

  const numHours = parseInt(hours || '0', 10) || 0
  const numMinutes = parseInt(minutes || '0', 10) || 0
  const numSeconds = parseInt(seconds || '0', 10) || 0
  const totalSeconds = numHours * 3600 + numMinutes * 60 + numSeconds

  const { usdEarned, gbpCredit } = calculateSessionValues(
    totalSeconds,
    agreement.hourlyRateUSD,
    agreement.exchangeRateUSDToGBP
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setDurationError(null)
    setDateError(null)
    setSaveError(null)

    if (!date) {
      setDateError('Please select a date.')
      return
    }

    if (totalSeconds <= 0) {
      setDurationError('Duration must be at least 1 second.')
      return
    }

    if (totalSeconds > 360000) {
      // 100 hours limit check
      setDurationError('Duration cannot exceed 100 hours in a single entry.')
      return
    }

    const session: WorkSession = {
      id: 'session-manual-' + Date.now(),
      agreementId: agreement.id,
      date,
      activeDurationSec: totalSeconds,
      taskNote: taskNote.trim() || undefined,
      usdEarned,
      hourlyRateUSD: agreement.hourlyRateUSD,
      exchangeRate: agreement.exchangeRateUSDToGBP,
      gbpCredit,
      appliedGbp: 0,
      excessGbp: 0,
      createdAt: new Date().toISOString(),
    }

    setIsSaving(true)
    try {
      if (!(await onSaveSession(session))) {
        setSaveError('Could not save the session. Please try again.')
        return
      }
      onClose()
    } catch {
      setSaveError('Could not save the session. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} title="Add time" hasUnsavedChanges={dirty}
      footer={<button type="submit" form={formId} disabled={isSaving} className="btn-base btn-offwhite w-full">{isSaving ? 'Saving…' : 'Save session'}</button>}>
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Date */}
        <div>
          <label htmlFor="add-time-date" className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Date
          </label>
          <DateField
            id="add-time-date"
            value={date}
            onChange={next => {
              setDate(next)
              setDateError(null)
            }}
          />
          {dateError && (
            <span className="block text-[12px] text-red-400 mt-1">{dateError}</span>
          )}
        </div>

        {/* 2. Duration (Hours, Minutes, Seconds in one row) */}
        <div>
          <span className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Duration
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="relative">
                <input
                  id="add-time-hours"
                  type="number"
                  min="0"
                  max="999"
                  value={hours}
                  onChange={(e) => {
                    setHours(e.target.value)
                    setDurationError(null)
                  }}
                  className="input-base pr-8 text-center tabular-nums"
                  placeholder="0"
                />
                <span className="absolute right-3 top-3.5 text-[13px] text-[#938D9F] pointer-events-none">
                  h
                </span>
              </div>
              <label htmlFor="add-time-hours" className="block text-[11px] text-[#938D9F] mt-1 text-center">Hours</label>
            </div>

            <div>
              <div className="relative">
                <input
                  id="add-time-minutes"
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => {
                    setMinutes(e.target.value)
                    setDurationError(null)
                  }}
                  className="input-base pr-8 text-center tabular-nums"
                  placeholder="0"
                />
                <span className="absolute right-3 top-3.5 text-[13px] text-[#938D9F] pointer-events-none">
                  m
                </span>
              </div>
              <label htmlFor="add-time-minutes" className="block text-[11px] text-[#938D9F] mt-1 text-center">Minutes</label>
            </div>

            <div>
              <div className="relative">
                <input
                  id="add-time-seconds"
                  type="number"
                  min="0"
                  max="59"
                  value={seconds}
                  onChange={(e) => {
                    setSeconds(e.target.value)
                    setDurationError(null)
                  }}
                  className="input-base pr-8 text-center tabular-nums"
                  placeholder="0"
                />
                <span className="absolute right-3 top-3.5 text-[13px] text-[#938D9F] pointer-events-none">
                  s
                </span>
              </div>
              <label htmlFor="add-time-seconds" className="block text-[11px] text-[#938D9F] mt-1 text-center">Seconds</label>
            </div>
          </div>
          {durationError && (
            <span className="block text-[12px] text-red-400 mt-1.5">{durationError}</span>
          )}
        </div>

        {/* 3. Optional Task */}
        <div>
          <label htmlFor="add-time-task" className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Task description <span className="text-[#938D9F] font-normal">(optional)</span>
          </label>
          <input
            id="add-time-task"
            type="text"
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            placeholder="e.g. Tidying the kitchen"
            className="input-base"
          />
        </div>

        {/* 4. Calculated Credit (Read-only) */}
        <div className="border-t border-[#2D2B35] pt-4">
          <span className="block text-[12px] font-medium text-[#ABA6B5] uppercase tracking-wider mb-2">
            Calculated credit
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-[28px] font-bold text-[#F5F2F8] tabular-nums">
              {formatGBP(Math.min(gbpCredit, remainingDebt), { allowLessThanPenny: true })} off
            </span>
            <div className="text-right text-[13px] text-[#ABA6B5]">
              <span>{formatUSD(usdEarned)} earned</span>
              <span className="block text-[11px] text-[#938D9F]">
                Total value {formatGBP(gbpCredit, { allowLessThanPenny: true })} · US$1 = £{agreement.exchangeRateUSDToGBP}
              </span>
            </div>
          </div>
        </div>

        {saveError && (
          <p role="alert" className="text-[13px] text-red-300 font-medium">
            {saveError}
          </p>
        )}

      </form>
    </ModalSheet>
  )
}
