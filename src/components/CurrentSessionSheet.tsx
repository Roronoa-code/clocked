import React, { useState, useEffect, useId } from 'react'
import { ModalSheet } from './ModalSheet'
import type { ActiveSession, Agreement } from '../types'
import { formatHMS, calculateSessionValues, formatUSD } from '../utils/calculations'

interface CurrentSessionSheetProps {
  isOpen: boolean
  onClose: () => void
  activeSession: ActiveSession | null
  taskNoteDraft: string
  elapsedSeconds: number
  agreement: Agreement
  onUpdateTaskNote: (note: string) => boolean | void | Promise<boolean | void>
  onCorrectTime: (newSeconds: number, taskNote?: string) => boolean | void | Promise<boolean | void>
}

export const CurrentSessionSheet: React.FC<CurrentSessionSheetProps> = ({
  isOpen,
  onClose,
  activeSession,
  taskNoteDraft,
  elapsedSeconds,
  agreement,
  onUpdateTaskNote,
  onCorrectTime,
}) => {
  const formId = useId()
  const [taskNote, setTaskNote] = useState(activeSession?.taskNote ?? taskNoteDraft)
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [corrHours, setCorrHours] = useState('0')
  const [corrMinutes, setCorrMinutes] = useState('0')
  const [corrSeconds, setCorrSeconds] = useState('0')
  const [editError, setEditError] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTaskNote(activeSession?.taskNote ?? taskNoteDraft)
      setEditError(false)
    }
  }, [activeSession?.id, isOpen])

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
  }, [isOpen, activeSession?.id])

  const isPaused = activeSession?.status === 'paused'

  // Calculations for correction preview
  const newSec =
    (parseInt(corrHours || '0', 10) || 0) * 3600 +
    (parseInt(corrMinutes || '0', 10) || 0) * 60 +
    (parseInt(corrSeconds || '0', 10) || 0)
  const dirty = taskNote !== (activeSession?.taskNote ?? taskNoteDraft)
    || isCorrecting && newSec !== elapsedSeconds

  const { usdEarned: previewUsd, gbpCredit: previewGbp } = calculateSessionValues(
    newSec,
    agreement.hourlyRateUSD,
    agreement.exchangeRateUSDToGBP
  )

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const saved = activeSession && isCorrecting && isPaused
      ? await onCorrectTime(newSec, taskNote)
      : await onUpdateTaskNote(taskNote)
    if (saved === false) {
      setEditError(true)
      return
    }
    onClose()
  }

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} title={activeSession ? 'Current session' : 'Next session task'}
      hasUnsavedChanges={dirty} footer={<button type="submit" form={formId} className="btn-base btn-violet w-full">{activeSession ? 'Done' : 'Save task'}</button>}>
      <form id={formId} onSubmit={handleSaveTask} className="space-y-5">
        {/* Task Note field */}
        <div>
          <label htmlFor={`${formId}-task`} className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
            Task description
          </label>
          <input
            id={`${formId}-task`}
            type="text"
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            placeholder="e.g. Tidying the kitchen"
            className="input-base"
            autoFocus
          />
        </div>

        {/* Current Duration Status */}
        {activeSession ? (
        <div className="border-y border-[#2D2B35] py-3 space-y-3">
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
                      id={`${formId}-hours`}
                      type="number"
                      min="0"
                      max="999"
                      value={corrHours}
                      onChange={(e) => setCorrHours(e.target.value)}
                      className="input-base text-center tabular-nums"
                    />
                    <label htmlFor={`${formId}-hours`} className="block text-[11px] text-[#938D9F] mt-1 text-center">Hours</label>
                  </div>
                  <div>
                    <input
                      id={`${formId}-minutes`}
                      type="number"
                      min="0"
                      max="59"
                      value={corrMinutes}
                      onChange={(e) => setCorrMinutes(e.target.value)}
                      className="input-base text-center tabular-nums"
                    />
                    <label htmlFor={`${formId}-minutes`} className="block text-[11px] text-[#938D9F] mt-1 text-center">Minutes</label>
                  </div>
                  <div>
                    <input
                      id={`${formId}-seconds`}
                      type="number"
                      min="0"
                      max="59"
                      value={corrSeconds}
                      onChange={(e) => setCorrSeconds(e.target.value)}
                      className="input-base text-center tabular-nums"
                    />
                    <label htmlFor={`${formId}-seconds`} className="block text-[11px] text-[#938D9F] mt-1 text-center">Seconds</label>
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
        ) : (
          <p className="text-[13px] text-[#ABA6B5]">
            This task will be added when you clock in.
          </p>
        )}

        {editError && (
          <p role="alert" className="text-[13px] text-[#F2A2A2]">
            Couldn’t save your changes. Please try again.
          </p>
        )}

      </form>
    </ModalSheet>
  )
}
