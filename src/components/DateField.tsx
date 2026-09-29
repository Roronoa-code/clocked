import { useId, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function parseDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!parts) return null
  const year = Number(parts[1])
  const month = Number(parts[2]) - 1
  const day = Number(parts[3])
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface Props {
  id: string
  value: string
  onChange: (value: string) => void
}

export function DateField({ id, value, onChange }: Props) {
  const selected = parseDate(value)
  const calendarId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => {
    const date = selected ?? new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1)
  })
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const leadingDays = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const days = new Date(year, monthIndex + 1, 0).getDate()

  const choose = (date: Date) => {
    onChange(dateValue(date))
    setOpen(false)
    trigger.current?.focus()
  }

  return <div onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }} onKeyDown={event => {
    if (open && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
  }}>
    <button ref={trigger} id={id} type="button" aria-expanded={open} aria-controls={calendarId}
      onClick={() => {
        if (!open) {
          const date = selected ?? new Date()
          setMonth(new Date(date.getFullYear(), date.getMonth(), 1))
        }
        setOpen(!open)
      }}
      className="input-base flex items-center justify-between text-left tabular-nums">
      <span>{selected ? new Intl.DateTimeFormat('en-GB').format(selected) : 'Select date'}</span>
      <CalendarDays className="h-5 w-5 text-[#ABA6B5]" aria-hidden="true" />
    </button>
    <div id={calendarId} className="calendar-expand" data-open={open} aria-hidden={!open} inert={!open}>
      <div>
        <div className="rounded-xl border border-[#2D2B35] bg-[#24242d] p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" disabled={!open} onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
              aria-label="Previous month" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#34343e] focus-visible:outline-2 focus-visible:outline-[#B6A0E9]"><ChevronLeft className="h-5 w-5" /></button>
            <strong className="text-sm font-semibold">{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(month)}</strong>
            <button type="button" disabled={!open} onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
              aria-label="Next month" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-[#34343e] focus-visible:outline-2 focus-visible:outline-[#B6A0E9]"><ChevronRight className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#ABA6B5]">
            {weekdays.map(day => <span key={day} className="py-1">{day}</span>)}
            {Array.from({ length: leadingDays }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: days }, (_, index) => {
              const date = new Date(year, monthIndex, index + 1)
              const iso = dateValue(date)
              return <button key={iso} type="button" disabled={!open} aria-pressed={iso === value}
                aria-label={new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)}
                onClick={() => choose(date)}
                className={`min-h-10 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-[#B6A0E9] ${iso === value ? 'bg-[#B6A0E9] text-[#151019]' : 'text-[#F5F2F8] hover:bg-[#34343e]'}`}>
                {index + 1}
              </button>
            })}
          </div>
          <button type="button" disabled={!open} onClick={() => choose(new Date())}
            className="mt-3 min-h-10 w-full rounded-lg text-sm font-medium text-[#B6A0E9] hover:bg-[#34343e] focus-visible:outline-2 focus-visible:outline-[#B6A0E9]">Today</button>
        </div>
      </div>
    </div>
  </div>
}
