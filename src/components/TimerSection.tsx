import React from 'react'
import { Pen, Loader2, Sparkles } from 'lucide-react'
import type { Agreement, ActiveSession, ActiveSessionStatus } from '../types'
import { formatHMS, calculateSessionValues, formatHoursMinutes } from '../utils/calculations'

interface TimerSectionProps {
  timerStatus: ActiveSessionStatus
  activeSession: ActiveSession | null
  elapsedSeconds: number
  agreement: Agreement
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
  onOpenConversionDetails: () => void
  onViewSessions?: () => void
}

export const TimerSection: React.FC<TimerSectionProps> = ({
  timerStatus,
  activeSession,
  elapsedSeconds,
  agreement,
  lastSavedInfo,
  saveErrorMessage,
  isAllSquareCompleted,
  totalSessionsCount,
  totalSavedSeconds,
  excessGbp,
  onClockIn,
  onPause,
  onResume,
  onSave,
  onRetrySave,
  onOpenCurrentSessionSheet,
  onOpenConversionDetails,
  onViewSessions,
}) => {
  // If completed and no active timer is running, render the All Square Completion summary!
  if (isAllSquareCompleted && timerStatus === 'idle') {
    return (
      <section
        id="main-timer-section"
        className="w-full bg-[#111114] border border-[#2D2B35] rounded-[20px] p-5 select-none text-center"
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-[#B6A0E9]" />
          <span className="text-[13px] font-semibold tracking-wider uppercase text-[#B6A0E9]">
            Agreement Settled
          </span>
        </div>

        <h3 className="text-2xl font-bold text-[#F5F2F8] tracking-tight mb-2">
          All square with {agreement.sisterName || 'your sister'}
        </h3>

        <p className="text-[15px] text-[#ABA6B5] mb-5 max-w-[320px] mx-auto">
          The full £{agreement.originalDebtGBP.toFixed(2)} debt has been worked off.
          {excessGbp > 0 && ` She worked an extra £${excessGbp.toFixed(2)} beyond the target.`}
        </p>

        <div className="grid grid-cols-2 gap-4 bg-[#19191F] border border-[#2D2B35] rounded-xl p-4 mb-5">
          <div className="text-left">
            <span className="block text-[13px] text-[#ABA6B5] mb-1">Total time</span>
            <span className="text-[20px] font-semibold text-[#F5F2F8] tabular-nums">
              {formatHoursMinutes(totalSavedSeconds)}
            </span>
          </div>
          <div className="text-left">
            <span className="block text-[13px] text-[#ABA6B5] mb-1">Sessions</span>
            <span className="text-[20px] font-semibold text-[#F5F2F8] tabular-nums">
              {totalSessionsCount}
            </span>
          </div>
        </div>

        {onViewSessions && (
          <button
            type="button"
            onClick={onViewSessions}
            className="w-full h-[52px] rounded-[14px] bg-[#19191F] border border-[#2D2B35] text-[#F5F2F8] font-semibold text-[16px] hover:bg-[#24242d] transition-colors"
          >
            View sessions
          </button>
        )}
      </section>
    )
  }

  // Calculate current session credit
  const { gbpCredit } = calculateSessionValues(
    elapsedSeconds,
    agreement.hourlyRateUSD,
    agreement.exchangeRateUSDToGBP
  )

  // Status line text
  let statusText = 'Ready'
  if (saveErrorMessage) {
    statusText = saveErrorMessage
  } else if (lastSavedInfo) {
    statusText = `Saved · ${lastSavedInfo.duration} · ${lastSavedInfo.gbpAmount} off`
  } else if (timerStatus === 'running') {
    statusText = 'Working'
  } else if (timerStatus === 'paused') {
    statusText = 'Paused'
  }

  // Hourly converted rate for rate line
  const convertedHourlyGbp = (agreement.hourlyRateUSD * agreement.exchangeRateUSDToGBP).toFixed(2)

  const isWorkingOrPaused = timerStatus === 'running' || timerStatus === 'paused'
  const isSaving = timerStatus === 'saving'
  const isSaveFailed = timerStatus === 'save_failed'

  const taskNote = activeSession?.taskNote?.trim()

  return (
    <section
      id="main-timer-section"
      className="w-full bg-[#111114] border border-[#2D2B35] rounded-[20px] p-5 select-none"
    >
      {/* 1. Status / Task Row */}
      <div className="flex items-center justify-between h-7 mb-4">
        {/* Left: State label */}
        <span
          className={`text-[13px] font-medium transition-colors ${
            saveErrorMessage
              ? 'text-[#F5F2F8] font-semibold'
              : lastSavedInfo
              ? 'text-[#B6A0E9] font-semibold'
              : timerStatus === 'running'
              ? 'text-[#B6A0E9]'
              : 'text-[#ABA6B5]'
          }`}
        >
          {statusText}
        </span>

        {/* Right: Add task / Task title */}
        <button
          type="button"
          onClick={onOpenCurrentSessionSheet}
          className="inline-flex items-center gap-1.5 text-[13px] text-[#ABA6B5] hover:text-[#F5F2F8] transition-colors py-1 px-2 rounded-md hover:bg-[#19191F] max-w-[180px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B6A0E9]"
        >
          {taskNote ? (
            <>
              <span className="truncate max-w-[140px] text-[#F5F2F8]">{taskNote}</span>
              <Pen className="w-3.5 h-3.5 shrink-0 text-[#ABA6B5]" />
            </>
          ) : (
            <>
              <span>+ Add task</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Timer Numerals */}
      <div className="text-center my-3">
        <div
          className="text-[48px] md:text-[64px] font-medium leading-none tracking-tight text-[#F5F2F8] tabular-nums"
          role="timer"
          aria-live="off"
        >
          {formatHMS(elapsedSeconds)}
        </div>
      </div>

      {/* 3. Session Credit Line */}
      <div className="text-center h-6 mb-6">
        <span className="text-[15px] text-[#ABA6B5]">
          £{gbpCredit.toFixed(2)} off this session
        </span>
      </div>

      {/* 4. Action Row (52px high, fixed bounds) */}
      <div className="h-[52px] w-full flex items-center justify-between mb-4">
        {!isWorkingOrPaused && !isSaving && !isSaveFailed ? (
          /* Idle: Full width Clock in */
          <button
            type="button"
            onClick={onClockIn}
            className="w-full h-[52px] rounded-[14px] bg-[#B6A0E9] text-[#151019] text-[16px] font-semibold hover:bg-[#c4b1ed] active:scale-[0.985] transition-all flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Clock in
          </button>
        ) : (
          /* Running / Paused / Saving / Save Failed: Two buttons (58% / 42% split with 8px gap) */
          <div className="w-full h-full flex items-center gap-2">
            {/* Left Control: Pause or Resume */}
            <div className="w-[58%] h-full">
              {timerStatus === 'running' ? (
                <button
                  type="button"
                  onClick={onPause}
                  disabled={isSaving}
                  className="w-full h-[52px] rounded-[14px] bg-[#19191F] border border-[#2D2B35] text-[#F5F2F8] text-[16px] font-semibold hover:bg-[#24242d] active:scale-[0.985] transition-all flex items-center justify-center disabled:opacity-40"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onResume}
                  disabled={isSaving}
                  className="w-full h-[52px] rounded-[14px] bg-[#B6A0E9] text-[#151019] text-[16px] font-semibold hover:bg-[#c4b1ed] active:scale-[0.985] transition-all flex items-center justify-center disabled:opacity-40"
                >
                  Resume
                </button>
              )}
            </div>

            {/* Right Control: Save / Saving... / Retry save */}
            <div className="w-[42%] h-full">
              {isSaveFailed ? (
                <button
                  type="button"
                  onClick={onRetrySave}
                  className="w-full h-[52px] rounded-[14px] bg-[#F5F2F8] text-[#151019] text-[16px] font-semibold hover:bg-white active:scale-[0.985] transition-all flex items-center justify-center"
                >
                  Retry save
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving}
                  className="w-full h-[52px] rounded-[14px] bg-[#F5F2F8] text-[#151019] text-[16px] font-semibold hover:bg-white active:scale-[0.985] transition-all flex items-center justify-center disabled:opacity-75"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin text-[#151019]" />
                      <span>Saving…</span>
                    </span>
                  ) : (
                    <span>Save</span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Hourly Rate Line */}
      <div className="text-center">
        <button
          type="button"
          onClick={onOpenConversionDetails}
          className="text-[13px] text-[#938D9F] hover:text-[#ABA6B5] transition-colors focus:outline-none focus-visible:underline"
          aria-label={`Hourly rate: US$${agreement.hourlyRateUSD} per hour, equivalent to £${convertedHourlyGbp} per hour. Click to view conversion details.`}
        >
          US${agreement.hourlyRateUSD}/hr · £{convertedHourlyGbp}/hr
        </button>
      </div>
    </section>
  )
}
