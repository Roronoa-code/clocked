import type { ActiveSession, Agreement, AppSettings, WorkSession } from '../types/index.js'

export interface ClockedData {
  agreement: Agreement | null
  sessions: WorkSession[]
  archives: { agreement: Agreement; sessions: WorkSession[] }[]
  activeSession: ActiveSession | null
  settings: AppSettings
}

export function sameActive(a: ActiveSession | null, b: ActiveSession | null): boolean {
  return a === b || !!a && !!b && a.id === b.id && a.agreementId === b.agreementId
    && a.startedAt === b.startedAt && a.activeDurationMs === b.activeDurationMs
    && a.currentRunStartedAt === b.currentRunStartedAt && a.status === b.status && a.taskNote === b.taskNote
}

export const emptyClockedData: ClockedData = {
  agreement: null,
  sessions: [],
  archives: [],
  activeSession: null,
  settings: { reducedMotion: 'system', showExcessDetails: true },
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number, optional = false): boolean =>
  optional && value === undefined || typeof value === 'string' && value.length <= max
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128
const amount = (value: unknown, positive = false): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= (positive ? Number.EPSILON : 0) && value <= 1e9
const instant = (value: unknown, optional = false): boolean =>
  optional && (value === undefined || value === null) || typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
const day = (value: unknown): boolean => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value)
}
const clockTime = (value: unknown): boolean => {
  if (value === undefined) return true
  if (typeof value !== 'string' || !/^\d{2}:\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes, seconds] = value.split(':').map(Number)
  return hours < 24 && minutes < 60 && seconds < 60
}

function agreement(value: unknown): value is Agreement {
  if (!object(value)) return false
  return id(value.id) && text(value.sisterName, 100) && amount(value.originalDebtGBP, true)
    && amount(value.hourlyRateUSD, true) && amount(value.exchangeRateUSDToGBP, true)
    && text(value.exchangeRateSource, 160) && day(value.exchangeRateDate)
    && instant(value.createdAt) && instant(value.completedAt, true)
    && (value.isArchived === undefined || typeof value.isArchived === 'boolean')
}

function session(value: unknown, agreementId: string): value is WorkSession {
  if (!object(value)) return false
  return id(value.id) && value.agreementId === agreementId && day(value.date)
    && clockTime(value.startTime)
    && Number.isSafeInteger(value.activeDurationSec) && (value.activeDurationSec as number) > 0
    && (value.activeDurationSec as number) <= 10 * 365 * 24 * 3600
    && text(value.taskNote, 2000, true) && amount(value.usdEarned)
    && (value.hourlyRateUSD === undefined || amount(value.hourlyRateUSD, true))
    && amount(value.exchangeRate, true) && amount(value.gbpCredit)
    && amount(value.appliedGbp) && amount(value.excessGbp)
    && instant(value.createdAt) && instant(value.updatedAt, true)
}

function sessions(value: unknown, agreementId: string): value is WorkSession[] {
  return Array.isArray(value) && value.length <= 10000
    && value.every(item => session(item, agreementId))
    && new Set(value.map(item => item.id)).size === value.length
}

function active(value: unknown, agreementId: string): value is ActiveSession {
  if (!object(value)) return false
  return id(value.id) && value.agreementId === agreementId
    && Number.isSafeInteger(value.startedAt) && (value.startedAt as number) > 0
    && Number.isSafeInteger(value.activeDurationMs) && (value.activeDurationMs as number) >= 0
    && (value.activeDurationMs as number) <= 10 * 365 * 24 * 3600 * 1000
    && (value.status === 'running' || value.status === 'paused')
    && (value.status === 'running'
      ? Number.isSafeInteger(value.currentRunStartedAt) && (value.currentRunStartedAt as number) > 0
      : value.currentRunStartedAt === null)
    && text(value.taskNote, 2000)
}

export function validateClockedData(value: unknown): value is ClockedData {
  if (!object(value)) return false
  if (value.agreement !== null && !agreement(value.agreement)) return false
  const currentId = value.agreement === null ? '' : (value.agreement as Agreement).id
  if (!sessions(value.sessions, currentId)) return false
  if (value.agreement === null && (value.sessions as WorkSession[]).length > 0) return false
  if (value.activeSession !== null && !active(value.activeSession, currentId)) return false
  if (value.agreement === null && value.activeSession !== null) return false
  if (value.activeSession && (value.sessions as WorkSession[]).some(item => item.id === (value.activeSession as ActiveSession).id)) return false
  if (!Array.isArray(value.archives) || value.archives.length > 100) return false
  for (const entry of value.archives) {
    if (!object(entry) || !agreement(entry.agreement)
      || !sessions(entry.sessions, (entry.agreement as Agreement).id)) return false
  }
  const settings = value.settings
  return object(settings)
    && (settings.reducedMotion === 'system' || typeof settings.reducedMotion === 'boolean')
    && typeof settings.showExcessDetails === 'boolean'
}
