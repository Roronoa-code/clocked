import type { ActiveSessionStatus } from '../types'
import './TimerActions.css'

interface Props {
  status: ActiveSessionStatus
  compact?: boolean
  onClockIn?: () => void
  onPause: () => void
  onResume: () => void
  onSave: () => void
  onRetrySave?: () => void
}

export function TimerActions({ status, compact = false, onClockIn, onPause, onResume, onSave, onRetrySave }: Props) {
  const active = status !== 'idle' && status !== 'saved'
  const frozen = status === 'saving' || status === 'save_failed'
  const leftText = !active ? 'Clock in' : status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : frozen ? 'Paused' : 'Clock in'
  const rightText = status === 'saving' ? 'Saving…' : status === 'save_failed' ? 'Retry save' : 'Save'
  const leftAction = !active ? onClockIn : status === 'running' ? onPause : status === 'paused' ? onResume : undefined
  return (
    <div className={`timer-actions ${compact ? 'timer-actions-compact' : ''}`} data-active={active}>
      <button type="button" className={`timer-action timer-action-main ${status === 'running' || frozen ? 'timer-action-quiet' : ''}`}
        onClick={leftAction} disabled={!leftAction}>
        {leftText}
      </button>
      <button type="button" className="timer-action timer-action-save" onClick={status === 'save_failed' ? onRetrySave : onSave}
        disabled={!active || status === 'saving'} tabIndex={active ? 0 : -1} aria-hidden={!active}>
        <span className="timer-action-save-label">{rightText}</span>
      </button>
    </div>
  )
}
