import React, { useState } from 'react'
import { ModalSheet } from './ModalSheet'
import type { WorkSession, Agreement } from '../types'
import { formatHMS, formatUSD, calculateSessionValues, formatHoursMinutes } from '../utils/calculations'
import { Trash2, Edit3 } from 'lucide-react'

interface SessionDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  session: WorkSession | null
  agreement: Agreement
  isCurrentSessionPending: boolean
  onUpdateSession: (updated: WorkSession) => void
  onDeleteSession: (sessionId: string) => void
}

export const SessionDetailSheet: React.FC<SessionDetailSheetProps> = ({
  isOpen,
  onClose,
  session,
  agreement,
  isCurrentSessionPending,
  onUpdateSession,
  onDeleteSession,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Edit fields
  const [editDate, setEditDate] = useState('')
  const [editHours, setEditHours] = useState('0')
  const [editMinutes, setEditMinutes] = useState('0')
  const [editSeconds, setEditSeconds] = useState('0')
  const [editTask, setEditTask] = useState('')

  // Initialize edit fields when session changes or editing begins
  const startEditing = () => {
    if (!session) return
    setIsEditing(true)
    setShowDeleteConfirm(false)
    setEditDate(session.date)
    const h = Math.floor(session.activeDurationSec / 3600)
    const m = Math.floor((session.activeDurationSec % 3600) / 60)
    const s = session.activeDurationSec % 60
    setEditHours(String(h))
    setEditMinutes(String(m))
    setEditSeconds(String(s))
    setEditTask(session.taskNote || '')
  }

  if (!session) return null

  // Calculations for edit mode
  const editSec =
    (parseInt(editHours || '0', 10) || 0) * 3600 +
    (parseInt(editMinutes || '0', 10) || 0) * 60 +
    (parseInt(editSeconds || '0', 10) || 0)

  const { usdEarned: editUsd, gbpCredit: editGbp } = calculateSessionValues(
    editSec,
    agreement.hourlyRateUSD,
    session.exchangeRate || agreement.exchangeRateUSDToGBP
  )

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editSec <= 0) return

    const updated: WorkSession = {
      ...session,
      date: editDate,
      activeDurationSec: editSec,
      taskNote: editTask.trim() || undefined,
      usdEarned: editUsd,
      gbpCredit: editGbp,
      updatedAt: new Date().toISOString(),
    }

    onUpdateSession(updated)
    setIsEditing(false)
    onClose()
  }

  const handleDelete = () => {
    onDeleteSession(session.id)
    setShowDeleteConfirm(false)
    onClose()
  }

  const sessionTitle = session.taskNote?.trim() || 'Work session'
  const sessionDuration = formatHoursMinutes(session.activeDurationSec)

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={() => {
        setIsEditing(false)
        setShowDeleteConfirm(false)
        onClose()
      }}
      title={isEditing ? 'Edit session' : 'Session details'}
      hasUnsavedChanges={isEditing}
    >
      {isEditing ? (
        /* EDIT FORM */
        <form onSubmit={handleSaveEdit} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Date
            </label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <input
                  type="number"
                  min="0"
                  max="999"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="input-base text-center tabular-nums"
                  placeholder="0"
                />
                <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Hours</span>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  className="input-base text-center tabular-nums"
                  placeholder="0"
                />
                <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Minutes</span>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={editSeconds}
                  onChange={(e) => setEditSeconds(e.target.value)}
                  className="input-base text-center tabular-nums"
                  placeholder="0"
                />
                <span className="block text-[11px] text-[#938D9F] mt-1 text-center">Seconds</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-[#ABA6B5] mb-2">
              Task description
            </label>
            <input
              type="text"
              value={editTask}
              onChange={(e) => setEditTask(e.target.value)}
              className="input-base"
              placeholder="e.g. Tidying the kitchen"
            />
          </div>

          <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4">
            <span className="block text-[12px] text-[#ABA6B5] uppercase mb-1">
              Recalculated value
            </span>
            <div className="text-[24px] font-bold text-[#F5F2F8] tabular-nums">
              £{editGbp.toFixed(2)}
            </div>
            <span className="text-[13px] text-[#ABA6B5]">
              {formatUSD(editUsd)} at locked rate US$1 = £{session.exchangeRate}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex-1 h-[52px] rounded-[14px] bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] font-semibold hover:bg-[#2d2d38] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 h-[52px] rounded-[14px] bg-[#F5F2F8] text-[#151019] font-semibold hover:bg-white transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>
      ) : showDeleteConfirm ? (
        /* INLINE DELETE CONFIRMATION */
        <div className="text-center py-4 space-y-5">
          <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-800/80 flex items-center justify-center mx-auto text-red-400">
            <Trash2 className="w-6 h-6 stroke-[1.8]" />
          </div>

          <div>
            <h4 className="text-[18px] font-semibold text-[#F5F2F8] mb-1">
              Delete this {sessionDuration} session?
            </h4>
            <p className="text-[14px] text-[#ABA6B5] max-w-[320px] mx-auto">
              "{sessionTitle}" from {session.date}. This will restore £{session.appliedGbp.toFixed(2)} back to the remaining debt.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 h-[52px] rounded-[14px] bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] font-semibold hover:bg-[#2d2d38] transition-colors"
            >
              Keep session
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 h-[52px] rounded-[14px] bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        /* DETAIL VIEW */
        <div className="space-y-5">
          {/* Header info */}
          <div>
            <h4 className="text-[20px] font-bold text-[#F5F2F8] break-words">
              {sessionTitle}
            </h4>
            <span className="text-[13px] text-[#ABA6B5]">
              {session.date} {session.startTime ? `at ${session.startTime}` : ''}
            </span>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-3.5">
              <span className="block text-[12px] text-[#938D9F] mb-1">Active duration</span>
              <span className="text-[18px] font-semibold text-[#F5F2F8] tabular-nums">
                {formatHMS(session.activeDurationSec)}
              </span>
            </div>

            <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-3.5">
              <span className="block text-[12px] text-[#938D9F] mb-1">USD earnings</span>
              <span className="text-[18px] font-semibold text-[#F5F2F8] tabular-nums">
                {formatUSD(session.usdEarned)}
              </span>
            </div>
          </div>

          {/* Debt breakdown card */}
          <div className="bg-[#111114] border border-[#2D2B35] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#ABA6B5]">Locked rate</span>
              <span className="text-[#F5F2F8] font-medium tabular-nums">
                US$1 = £{session.exchangeRate}
              </span>
            </div>

            <div className="flex items-center justify-between text-[14px]">
              <span className="text-[#ABA6B5]">Total GBP value</span>
              <span className="text-[#F5F2F8] font-medium tabular-nums">
                £{session.gbpCredit.toFixed(2)}
              </span>
            </div>

            <div className="border-t border-[#2D2B35] pt-2 flex items-center justify-between text-[15px]">
              <span className="text-[#F5F2F8] font-semibold">Applied to debt</span>
              <span className="text-[#B6A0E9] font-bold tabular-nums">
                £{session.appliedGbp.toFixed(2)}
              </span>
            </div>

            {session.excessGbp > 0 && (
              <div className="bg-[#19191F] border border-[#2D2B35] rounded-lg p-2.5 mt-2 text-[13px] text-[#ABA6B5]">
                <strong className="text-[#F5F2F8]">Excess work: £{session.excessGbp.toFixed(2)}.</strong>{' '}
                This session completed the debt; extra time worked is preserved here and does not count as money owed.
              </div>
            )}
          </div>

          {/* Pending warning if timer is running */}
          {isCurrentSessionPending ? (
            <div className="p-3 bg-[#111114] border border-[#2D2B35] rounded-xl text-[13px] text-[#ABA6B5] text-center">
              Save the current session first before editing or deleting historical sessions.
            </div>
          ) : (
            /* Action Buttons: Edit and Delete */
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={startEditing}
                className="w-full h-[52px] rounded-[14px] bg-[#24242d] border border-[#2D2B35] text-[#F5F2F8] text-[16px] font-semibold hover:bg-[#2d2d38] active:scale-[0.985] transition-all flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4 stroke-[1.8]" />
                <span>Edit session</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full h-[48px] rounded-[14px] text-red-400 hover:text-red-300 hover:bg-red-950/20 text-[15px] font-medium transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 stroke-[1.8]" />
                <span>Delete session</span>
              </button>
            </div>
          )}
        </div>
      )}
    </ModalSheet>
  )
}
