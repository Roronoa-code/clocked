import React, { useState, useEffect } from 'react'
import { ModalSheet } from './ModalSheet'
import type { ActiveSession, Agreement } from '../types'
import { formatHMS, calculateSessionValues, formatUSD } from '../utils/calculations'

interface CurrentSessionSheetProps {
  isOpen: boolean
  onClose: () => void
  activeSession: ActiveSession | null
  elapsedSeconds: number
  agreement: Agreement
  onUpdateTaskNote: (note: string) => void
  onCorrectTime: (newSeconds: number) => void
}

export const CurrentSessionSheet: React.FC<CurrentSessionSheetProps> = ({
  isOpen,
  onClose,
  activeSession,
  elapsedSeconds,
  agreement,
  onUpdateTaskNote,
  onCorrectTime,
}) => {
  const [taskNote, setTaskNote] = useState(activeSession?.taskNote || '')
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [corrHours, setCorrHours] = useState('0')
  const [corrMinutes, setCorrMinutes] = useState('0')
  const [corrSeconds, setCorrSeconds] = useState('0')

  useEffect(() => {
    if (activeSession) {
      setTaskNote(activeSession.taskNote || '')
    }
  }, [activeSession])

  useEffect(() => {
    if (isOpen) {
      const h = Math.floor(elapsedSeconds / 3600)
      const m = Math.floor((elapsedSeconds % 3600) / 60)
      const s = elapsedSeconds % 60
      setCorrHours(String(h))
      setCorrMinutes(String(m))
      setCorrSeconds(String(s))
      setIsCorrecting(false)
    }
  }, [isOpen, elapsedSeconds])

  if (!activeSession) return null

  const isPaused = activeSession.status === 'paused'

  // Calculations for correction preview
  const newSec =
    (parseInt(corrHours || '0', 10) || 0) * 3600 +
    (parseInt(corrMinutes || '0', 10) || 0) * 60 +
    (parseInt(corrSeconds || '0', 10) || 0)

  const { usdEarned: previewUsd, gbpCredit: previewGbp } = calculateSessionValues(
    newSec,
    agreement.hourlyRateUSD,
    agreement.exchangeRateUSDToGBP
  )

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateTaskNote(taskNote)
    if (isCorrecting && isPaused) {
      onCorrectTime(newSec)
    }
    onClose()
  }

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} title="Current session">
      <form onSubmit={handleSaveTask} className="space-y-5">
        {/* Task Note field */}
        <div>
          <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Task description
          </label>
          <input
            type="text"
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            placeholder="e.g. Tidying the kitchen"
            className="input-base"
            autoFocus
          />
        </div>

        {/* Current Duration Status */}
        <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#ABA6B5]">Active duration</span>
            <span className="text-[18px] font-bold text-[#F5F2F8] tabular-nums">
              {formatHMS(elapsedSeconds)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[13px] text-[#ABA6B5]">
            <span>Session status</span>
            <span className="text-[#B6A0E9] font-medium capitalize">
              {activeSession.status}
            </span>
          </div>

          {/* Time correction section */}
          {isPaused ? (
            !isCorrecting ? (
              <div className="pt-2 border-t border-[#2D2B35]">
                <button
                  type="button"
                  onClick={() => setIsCorrecting(true)}
                  className="text-[13px] font-medium text-[#B6A0E9] hover:underline"
                >
                  Correct duration
                </button>
              </div>
            ) : (
              <div className="pt-3 border-t border-[#2D2B35] space-y-3">
                <span className="block text-[12px] font-semibold text-[#F5F2F8]">
                  Adjust elapsed time
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      value={corrHours}
                      onChange={(e) => setCorrHours(e.target.value)}
                      className="input-base text-center tabular-nums"
                    />
                    <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Hours</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={corrMinutes}
                      onChange={(e) => setCorrMinutes(e.target.value)}
                      className="input-base text-center tabular-nums"
                    />
                    <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Minutes</span>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={corrSeconds}
                      onChange={(e) => setCorrSeconds(e.target.value)}
                      className="input-base text-center tabular-nums"
                    />
                    <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Seconds</span>
                  </div>
                </div>

                <div className="text-[12px] text-[#ABA6B5]">
                  Updated credit: <strong className="text-[#F5F2F8]">£{previewGbp.toFixed(2)}</strong> ({formatUSD(previewUsd)})
                </div>
              </div>
            )
          ) : (
            <p className="text-[12px] text-[#938D9F] pt-1">
              Pause the session if you need to correct the recorded duration.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full h-[52px] rounded-[14px] bg-[#B6A0E9] text-[#151019] text-[16px] font-semibold hover:bg-[#c4b1ed] active:scale-[0.985] transition-all flex items-center justify-center"
          >
            Done
          </button>
        </div>
      </form>
    </ModalSheet>
  )
}
