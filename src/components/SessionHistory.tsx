import React, { useEffect, useRef } from 'react'
import { ArrowUpRight, Clock3, ReceiptText } from 'lucide-react'
import type { WorkSession } from '../types'
import { formatHoursMinutes, formatUSD } from '../utils/calculations'

interface SessionHistoryProps {
  sessions: WorkSession[]
  onOpenAddTime: () => void
  onSelectSession: (session: WorkSession) => void
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({
  sessions,
  onOpenAddTime,
  onSelectSession,
}) => {
  const previousIds = useRef<Set<string> | null>(null)
  const addedIds = new Set(previousIds.current === null ? [] : sessions.filter(item => !previousIds.current!.has(item.id)).map(item => item.id))
  useEffect(() => { previousIds.current = new Set(sessions.map(item => item.id)) }, [sessions])
  // Format date helper: "Today", "Yesterday", or formatted date string
  const getGroupLabel = (dateStr: string) => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`

    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
      yesterday.getDate()
    ).padStart(2, '0')}`

    if (dateStr === todayStr) return 'Today'
    if (dateStr === yesterdayStr) return 'Yesterday'

    try {
      const parts = dateStr.split('-')
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    } catch {}
    return dateStr
  }

  // Sort sessions reverse chronologically for display
  const sortedSessions = [...sessions].sort((a, b) => {
    const timeA = new Date(a.date + (a.startTime ? `T${a.startTime}` : 'T00:00:00')).getTime()
    const timeB = new Date(b.date + (b.startTime ? `T${b.startTime}` : 'T00:00:00')).getTime()
    if (timeA !== timeB) return timeB - timeA
    return (b.createdAt || '').localeCompare(a.createdAt || '')
  })

  // Group by date string
  const grouped: { dateKey: string; label: string; items: WorkSession[] }[] = []
  for (const session of sortedSessions) {
    const lastGroup = grouped[grouped.length - 1]
    if (lastGroup && lastGroup.dateKey === session.date) {
      lastGroup.items.push(session)
    } else {
      grouped.push({
        dateKey: session.date,
        label: getGroupLabel(session.date),
        items: [session],
      })
    }
  }

  return (
    <section className="w-full select-none mt-2 mb-12">
      {/* Header */}
      <div className="flex items-center justify-between h-10 mb-2">
        <h2 className="flex items-center gap-2 text-[18px] md:text-[20px] font-semibold text-[#F5F2F8] tracking-tight">
          Sessions
          <span className="session-count tabular-nums">{sessions.length}</span>
        </h2>

        <button
          type="button"
          onClick={onOpenAddTime}
          className="min-h-11 text-[13px] font-medium text-[#C8B3F2] hover:text-white py-1.5 px-2.5 rounded-lg hover:bg-[#19191F] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B6A0E9]"
        >
          + Add time
        </button>
      </div>

      {/* History List or Empty State */}
      {sessions.length === 0 ? (
        <div className="empty-time-card">
          <span className="empty-receipt" aria-hidden="true"><ReceiptText size={29} strokeWidth={1.5} /></span>
          <p className="text-[15px] font-medium">No sessions yet</p>
          <p className="mt-1 text-[13px] text-[#ABA6B5]">Clock in to start, or add time above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={`group-${group.dateKey}`} className="space-y-1">
              {/* Group Date Subheading */}
              <div className="py-1">
                <span className="text-[13px] font-medium text-[#938D9F] uppercase tracking-wider">
                  {group.label}
                </span>
              </div>

              {/* Sessions in group */}
              <div className="divide-y divide-[#2D2B35] border-t border-b border-[#2D2B35]">
                {group.items.map((session) => {
                  const durationFormatted = formatHoursMinutes(session.activeDurationSec)
                  const title = session.taskNote?.trim() || 'Work session'
                  const gbpOff = session.appliedGbp > 0 && session.appliedGbp < 0.01
                    ? '<0.01'
                    : session.appliedGbp.toFixed(2)

                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onSelectSession(session)}
                      className={`session-receipt w-full min-h-[72px] py-3.5 flex items-center justify-between gap-2.5 text-left hover:bg-[#111114] active:bg-[#19191F] px-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B6A0E9] group ${addedIds.has(session.id) ? 'session-row-new' : ''}`}
                    >
                      <span className="session-source" aria-hidden="true"><Clock3 size={17} /></span>
                      {/* Left: Task name & metadata */}
                      <div className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-[#F5F2F8] truncate group-hover:text-white">
                          {title}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-[#ABA6B5] mt-0.5">
                          <span className="tabular-nums">{durationFormatted}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formatUSD(session.usdEarned)}</span>
                          {session.excessGbp > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[#B6A0E9] text-[12px]">
                                (£{session.excessGbp.toFixed(2)} excess)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right: GBP reduction */}
                      <div className="shrink-0 text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-[15px] font-semibold text-[#CCB7F4] tabular-nums">
                            £{gbpOff}
                          </span>
                          <span className="text-[12px] text-[#ABA6B5] font-normal">
                            off
                          </span>
                        </div>
                        <ArrowUpRight size={13} className="session-open ml-auto mt-1 text-[#938D9F]" aria-hidden="true" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
