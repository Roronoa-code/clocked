import React from 'react'
import { formatHoursMinutes, formatEstimatedWork } from '../utils/calculations'

interface SupportingTotalsProps {
  totalSavedSeconds: number
  estimatedSecondsRemaining: number
  isSessionActive: boolean
}

export const SupportingTotals: React.FC<SupportingTotalsProps> = ({
  totalSavedSeconds,
  estimatedSecondsRemaining,
  isSessionActive,
}) => {
  return (
    <div className="w-full grid grid-cols-2 gap-6 my-6 px-1 select-none">
      {/* Left Column: Total time worked */}
      <div>
        <span className="block text-[13px] text-[#ABA6B5] mb-1 font-medium">
          Total time worked
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] md:text-[28px] font-semibold text-[#F5F2F8] tabular-nums tracking-tight">
            {formatHoursMinutes(totalSavedSeconds)}
          </span>
          {isSessionActive && (
            <span className="text-[12px] text-[#938D9F] tracking-normal font-normal">
              saved
            </span>
          )}
        </div>
      </div>

      {/* Right Column: Work left */}
      <div>
        <span className="block text-[13px] text-[#ABA6B5] mb-1 font-medium">
          Work left
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] md:text-[28px] font-semibold text-[#F5F2F8] tabular-nums tracking-tight">
            {formatEstimatedWork(estimatedSecondsRemaining)}
          </span>
          {isSessionActive && (
            <span className="text-[12px] text-[#938D9F] tracking-normal font-normal">
              est.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
