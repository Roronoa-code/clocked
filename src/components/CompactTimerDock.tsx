import React from 'react'
import { Loader2 } from 'lucide-react'
import type { ActiveSessionStatus } from '../types'
import { formatHMS } from '../utils/calculations'

interface CompactTimerDockProps {
  isVisible: boolean
  timerStatus: ActiveSessionStatus
  elapsedSeconds: number
  onPause: () => void
  onResume: () => void
  onSave: () => void
}

export const CompactTimerDock: React.FC<CompactTimerDockProps> = ({
  isVisible,
  timerStatus,
  elapsedSeconds,
  onPause,
  onResume,
  onSave,
}) => {
  if (!isVisible) return null

  const isSaving = timerStatus === 'saving'

  return (
    <aside
      role="region"
      aria-label="Active timer quick controls"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#19191F] border-t border-[#2D2B35] pb-safe shadow-2xl transition-transform duration-180 ease-out md:hidden"
    >
      <div className="h-[72px] px-5 flex items-center justify-between gap-3 max-w-[500px] mx-auto">
        {/* Current Timer reading */}
        <div className="flex flex-col">
          <span className="text-[11px] text-[#ABA6B5] uppercase font-semibold tracking-wider">
            {timerStatus === 'running' ? 'Working' : 'Paused'}
          </span>
          <span className="text-[24px] font-semibold text-[#F5F2F8] tabular-nums leading-tight">
            {formatHMS(elapsedSeconds)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {timerStatus === 'running' ? (
            <button
              type="button"
              onClick={onPause}
              disabled={isSaving}
              className="h-[44px] px-4 rounded-[12px] bg-[#2D2B35] text-[#F5F2F8] text-[15px] font-semibold hover:bg-[#383642] active:scale-[0.985] transition-all disabled:opacity-40"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              disabled={isSaving}
              className="h-[44px] px-4 rounded-[12px] bg-[#B6A0E9] text-[#151019] text-[15px] font-semibold hover:bg-[#c4b1ed] active:scale-[0.985] transition-all disabled:opacity-40"
            >
              Resume
            </button>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-[44px] px-4 rounded-[12px] bg-[#F5F2F8] text-[#151019] text-[15px] font-semibold hover:bg-white active:scale-[0.985] transition-all disabled:opacity-75 flex items-center justify-center min-w-[70px]"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#151019]" />
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </aside>
  )
}
