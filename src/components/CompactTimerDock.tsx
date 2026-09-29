import { useEffect, useRef } from 'react'
import type { ActiveSessionStatus } from '../types'
import { formatHMS } from '../utils/calculations'
import { TimerActions } from './TimerActions'

interface Props {
  isVisible: boolean
  timerStatus: ActiveSessionStatus
  elapsedSeconds: number
  onPause: () => void
  onResume: () => void
  onSave: () => void
  onRetrySave: () => void
}

export function CompactTimerDock({ isVisible, timerStatus, elapsedSeconds, onPause, onResume, onSave, onRetrySave }: Props) {
  const lastVisible = useRef({ timerStatus, elapsedSeconds })
  useEffect(() => {
    if (isVisible) lastVisible.current = { timerStatus, elapsedSeconds }
  }, [isVisible, timerStatus, elapsedSeconds])
  const display = isVisible ? { timerStatus, elapsedSeconds } : lastVisible.current
  return (
    <aside role="region" aria-label="Active timer quick controls" aria-hidden={!isVisible} inert={!isVisible} data-visible={isVisible}
      className="timer-dock fixed bottom-0 inset-x-0 z-40 border-t border-[#2D2B35] bg-[#19191F] px-5 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-2xl min-[1280px]:hidden">
      <div className="mx-auto max-w-[560px] flex min-h-[56px] items-center gap-3">
        <div className="shrink-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#ABA6B5]">{display.timerStatus === 'running' ? 'Working' : display.timerStatus === 'save_failed' ? 'Time kept' : display.timerStatus === 'saving' ? 'Saving' : 'Paused'}</span>
          <span className="block text-[20px] font-semibold tabular-nums leading-tight">{formatHMS(display.elapsedSeconds)}</span>
        </div>
        <div className="min-w-0 flex-1"><TimerActions compact status={display.timerStatus} onPause={onPause} onResume={onResume} onSave={onSave} onRetrySave={onRetrySave} /></div>
      </div>
    </aside>
  )
}
