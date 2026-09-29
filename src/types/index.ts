export interface Agreement {
  id: string
  sisterName: string
  originalDebtGBP: number // e.g. 60.00
  hourlyRateUSD: number // e.g. 6.00
  exchangeRateUSDToGBP: number // e.g. 0.80 (meaning US$1 = £0.80)
  exchangeRateSource: string // e.g. "open.er-api.com (ECB)" or "Agreed test rate"
  exchangeRateDate: string // e.g. "2026-09-29"
  createdAt: string // ISO string
  isArchived?: boolean
  completedAt?: string | null
}

export interface WorkSession {
  id: string
  agreementId: string
  date: string // YYYY-MM-DD
  startTime?: string // ISO timestamp or HH:mm
  activeDurationSec: number // exact active seconds
  taskNote?: string // e.g. "Tidying the kitchen"
  usdEarned: number // high precision
  hourlyRateUSD?: number // rate snapshot; absent on legacy sessions
  exchangeRate: number // the rate applied
  gbpCredit: number // total GBP value of work
  appliedGbp: number // portion applied to debt
  excessGbp: number // portion beyond debt if any
  createdAt: string
  updatedAt?: string
}

export type ActiveSessionStatus = 'idle' | 'running' | 'paused' | 'saving' | 'save_failed' | 'saved'

export interface ActiveSession {
  id: string
  agreementId: string
  startedAt: number // Date.now() timestamp
  activeDurationMs: number // accumulated milliseconds while paused/stopped
  currentRunStartedAt: number | null // timestamp if running, null if paused
  status: 'running' | 'paused'
  taskNote: string
}

export interface AppSettings {
  reducedMotion: boolean | 'system'
  showExcessDetails: boolean
}

export interface CalculationSummary {
  totalSavedSeconds: number
  totalUsdEarned: number
  totalGbpCredit: number
  totalCreditApplied: number
  remainingDebt: number
  excessGbp: number
  isAllSquare: boolean
  isLessThanOnePenny: boolean
  projectedRemaining: number
  projectedCredit: number
  projectedExcess: number
  projectedSeconds: number
  estimatedSecondsRemaining: number
  marksCleared: number // fractional number of marks (0 - 60)
  marksTotal: number // usually 60
}
