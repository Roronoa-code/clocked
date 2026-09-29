import React, { useState } from 'react'
import { ModalSheet } from './ModalSheet'
import type { Agreement, WorkSession } from '../types'
import { calculateSessionValues, formatUSD } from '../utils/calculations'

interface AddTimeSheetProps {
  isOpen: boolean
  onClose: () => void
  agreement: Agreement
  onSaveSession: (session: WorkSession) => void
}

export const AddTimeSheet: React.FC<AddTimeSheetProps> = ({
  isOpen,
  onClose,
  agreement,
  onSaveSession,
}) => {
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

  const numHours = parseInt(hours || '0', 10) || 0
  const numMinutes = parseInt(minutes || '0', 10) || 0
  const numSeconds = parseInt(seconds || '0', 10) || 0
  const totalSeconds = numHours * 3600 + numMinutes * 60 + numSeconds

  const { usdEarned, gbpCredit } = calculateSessionValues(
    totalSeconds,
    agreement.hourlyRateUSD,
    agreement.exchangeRateUSDToGBP
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setDurationError(null)
    setDateError(null)

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
      startTime: new Date().toTimeString().split(' ')[0],
      activeDurationSec: totalSeconds,
      taskNote: taskNote.trim() || undefined,
      usdEarned,
      exchangeRate: agreement.exchangeRateUSDToGBP,
      gbpCredit,
      appliedGbp: 0,
      excessGbp: 0,
      createdAt: new Date().toISOString(),
    }

    onSaveSession(session)
    onClose()
  }

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} title="Add time">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Date */}
        <div>
          <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setDateError(null)
            }}
            className="input-base"
            required
          />
          {dateError && (
            <span className="block text-[12px] text-red-400 mt-1">{dateError}</span>
          )}
        </div>

        {/* 2. Duration (Hours, Minutes, Seconds in one row) */}
        <div>
          <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="relative">
                <input
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
              <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Hours</span>
            </div>

            <div>
              <div className="relative">
                <input
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
              <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Minutes</span>
            </div>

            <div>
              <div className="relative">
                <input
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
              <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Seconds</span>
            </div>
          </div>
          {durationError && (
            <span className="block text-[12px] text-red-400 mt-1.5">{durationError}</span>
          )}
        </div>

        {/* 3. Optional Task */}
        <div>
          <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Task description <span className="text-[#938D9F] font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            placeholder="e.g. Tidying the kitchen"
            className="input-base"
          />
        </div>

        {/* 4. Calculated Credit (Read-only) */}
        <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4">
          <span className="block text-[12px] font-medium text-[#ABA6B5] uppercase tracking-wider mb-2">
            Calculated credit
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-[28px] font-bold text-[#F5F2F8] tabular-nums">
              £{gbpCredit.toFixed(2)} off
            </span>
            <div className="text-right text-[13px] text-[#ABA6B5]">
              <span>{formatUSD(usdEarned)} earned</span>
              <span className="block text-[11px] text-[#938D9F]">
                US$1 = £{agreement.exchangeRateUSDToGBP}
              </span>
            </div>
          </div>
        </div>

        {/* 5. Save session action */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full h-[52px] rounded-[14px] bg-[#F5F2F8] text-[#151019] text-[16px] font-semibold hover:bg-white active:scale-[0.985] transition-all flex items-center justify-center"
          >
            Save session
          </button>
        </div>
      </form>
    </ModalSheet>
  )
}
