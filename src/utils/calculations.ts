import type { Agreement, WorkSession, CalculationSummary } from '../types'

/**
 * Normalizes floating point calculations to 8 decimal places to eliminate IEEE-754 epsilon drift
 * while preserving fractional pennies accurately (e.g. 1/1000th of a penny is 0.00001).
 */
export function roundToPrecision(value: number, decimals: number = 8): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Calculates USD earned from active working seconds at the given hourly rate.
 * Formula: active seconds worked × hourlyRateUSD ÷ 3600
 */
export function calculateUsdEarned(activeSeconds: number, hourlyRateUSD: number = 6.0): number {
  if (activeSeconds <= 0) return 0
  return roundToPrecision((activeSeconds * hourlyRateUSD) / 3600)
}

/**
 * Calculates GBP credit from USD earned and the agreed exchange rate (US$1 = £exchangeRate).
 * Formula: USD earned × agreed GBP-per-USD exchange rate
 */
export function calculateGbpCredit(usdEarned: number, exchangeRateUSDToGBP: number): number {
  if (usdEarned <= 0 || exchangeRateUSDToGBP <= 0) return 0
  return roundToPrecision(usdEarned * exchangeRateUSDToGBP)
}

/**
 * Calculates session values using the eight-decimal rounding policy.
 */
export function calculateSessionValues(
  activeSeconds: number,
  hourlyRateUSD: number,
  exchangeRateUSDToGBP: number
): { usdEarned: number; gbpCredit: number } {
  const usdEarned = calculateUsdEarned(activeSeconds, hourlyRateUSD)
  const gbpCredit = calculateGbpCredit(usdEarned, exchangeRateUSDToGBP)
  return { usdEarned, gbpCredit }
}

/**
 * Recalculates all saved sessions chronologically against the agreement's debt.
 * Sessions with rate snapshots are recalculated from those snapshots; legacy
 * sessions without snapshots keep their saved USD and GBP amounts.
 * Ensures:
 * 1. Session credit is preserved to eight decimals without penny rounding drift.
 * 2. appliedGbp per session accurately tracks how much that session knocked off the debt.
 * 3. excessGbp records any work done past zero debt.
 * 4. Remaining debt never drops below zero.
 * 5. The standard 5-minute benchmark matches a 60-minute session.
 */
export function recalculateSessions(
  sessions: WorkSession[],
  agreement: Agreement
): {
  recalculatedSessions: WorkSession[]
  summary: CalculationSummary
} {
  // Sort chronologically ascending to properly apply debt caps
  const sorted = [...sessions].sort((a, b) => {
    const timeA = new Date(a.date + (a.startTime ? `T${a.startTime}` : 'T00:00:00')).getTime()
    const timeB = new Date(b.date + (b.startTime ? `T${b.startTime}` : 'T00:00:00')).getTime()
    if (timeA !== timeB) return timeA - timeB
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  let remainingDebt = roundToPrecision(agreement.originalDebtGBP)
  let totalSavedSeconds = 0
  let totalUsdEarned = 0
  let totalGbpCredit = 0
  let totalCreditApplied = 0
  let totalExcessGbp = 0

  const recalculatedSessions: WorkSession[] = sorted.map((session) => {
    const hasRateSnapshots =
      session.hourlyRateUSD != null &&
      Number.isFinite(session.hourlyRateUSD) &&
      Number.isFinite(session.exchangeRate)
    const rate = session.exchangeRate
    const { usdEarned, gbpCredit } = hasRateSnapshots
      ? calculateSessionValues(session.activeDurationSec, session.hourlyRateUSD!, rate)
      : { usdEarned: session.usdEarned, gbpCredit: session.gbpCredit }

    totalSavedSeconds += session.activeDurationSec
    totalUsdEarned = roundToPrecision(totalUsdEarned + usdEarned)
    totalGbpCredit = roundToPrecision(totalGbpCredit + gbpCredit)

    const appliedGbp = roundToPrecision(Math.max(0, Math.min(gbpCredit, remainingDebt)))
    const excessGbp = roundToPrecision(Math.max(0, gbpCredit - appliedGbp))

    remainingDebt = roundToPrecision(Math.max(0, remainingDebt - appliedGbp))
    totalCreditApplied = roundToPrecision(totalCreditApplied + appliedGbp)
    totalExcessGbp = roundToPrecision(totalExcessGbp + excessGbp)

    return {
      ...session,
      usdEarned,
      exchangeRate: rate,
      gbpCredit,
      appliedGbp,
      excessGbp,
    }
  })

  const idMap = new Map(recalculatedSessions.map((s) => [s.id, s]))
  const updatedOriginalList = sessions.map((s) => idMap.get(s.id) || s)

  const cleanRemainingDebt = remainingDebt

  // Check if positive but less than one penny (0 < debt < 0.01)
  const isLessThanOnePenny = cleanRemainingDebt > 0 && cleanRemainingDebt < 0.01
  const isAllSquare = cleanRemainingDebt === 0

  // Marks: 60 marks total. For £60 agreement, 1 mark = £1.
  const marksTotal = 60
  const markUnitValue = agreement.originalDebtGBP > 0 ? agreement.originalDebtGBP / marksTotal : 1
  const marksCleared = Math.min(marksTotal, totalCreditApplied / markUnitValue)

  // Estimated working time remaining at agreed rate
  const creditPerSec = (agreement.hourlyRateUSD * agreement.exchangeRateUSDToGBP) / 3600
  const rawSecondsRemaining = creditPerSec > 0 ? cleanRemainingDebt / creditPerSec : 0
  const estimatedSecondsRemaining = Math.ceil(rawSecondsRemaining)

  const summary: CalculationSummary = {
    totalSavedSeconds,
    totalUsdEarned,
    totalGbpCredit,
    totalCreditApplied,
    remainingDebt: cleanRemainingDebt,
    excessGbp: totalExcessGbp,
    isAllSquare,
    isLessThanOnePenny,
    projectedRemaining: cleanRemainingDebt,
    projectedCredit: 0,
    projectedExcess: 0,
    projectedSeconds: 0,
    estimatedSecondsRemaining,
    marksCleared,
    marksTotal,
  }

  return {
    recalculatedSessions: updatedOriginalList,
    summary,
  }
}

/**
 * Computes projected summary when there is a running/paused active session.
 */
export function calculateProjectedSummary(
  savedSummary: CalculationSummary,
  pendingActiveSeconds: number,
  agreement: Agreement
): CalculationSummary {
  if (pendingActiveSeconds <= 0) {
    return { ...savedSummary }
  }

  const { gbpCredit: pendingGbp } = calculateSessionValues(
    pendingActiveSeconds,
    agreement.hourlyRateUSD,
    agreement.exchangeRateUSDToGBP
  )

  const projectedApplied = roundToPrecision(Math.max(0, Math.min(pendingGbp, savedSummary.remainingDebt)))
  const projectedExcess = roundToPrecision(Math.max(0, pendingGbp - projectedApplied))
  const projectedRemaining = roundToPrecision(Math.max(0, savedSummary.remainingDebt - projectedApplied))
  const cleanProjectedRemaining = projectedRemaining

  const isLessThanOnePenny = cleanProjectedRemaining > 0 && cleanProjectedRemaining < 0.01
  const isAllSquare = cleanProjectedRemaining === 0

  const markUnitValue = agreement.originalDebtGBP > 0 ? agreement.originalDebtGBP / savedSummary.marksTotal : 1
  const marksCleared = Math.min(
    savedSummary.marksTotal,
    (savedSummary.totalCreditApplied + projectedApplied) / markUnitValue
  )

  const creditPerSec = (agreement.hourlyRateUSD * agreement.exchangeRateUSDToGBP) / 3600
  const rawSecondsRemaining = creditPerSec > 0 ? cleanProjectedRemaining / creditPerSec : 0
  const estimatedSecondsRemaining = Math.ceil(rawSecondsRemaining)

  return {
    ...savedSummary,
    projectedRemaining: cleanProjectedRemaining,
    projectedCredit: pendingGbp,
    projectedExcess,
    projectedSeconds: pendingActiveSeconds,
    isAllSquare,
    isLessThanOnePenny,
    estimatedSecondsRemaining,
    marksCleared,
  }
}

/**
 * Format currency in GBP.
 * Round money only for display.
 */
export function formatGBP(amount: number, options?: { showPence?: boolean; allowLessThanPenny?: boolean }): string {
  if (options?.allowLessThanPenny && amount > 0 && amount < 0.01) {
    return 'Less than £0.01'
  }
  const formatted = Math.abs(amount).toFixed(2)
  return `£${formatted}`
}

/**
 * Format currency in USD.
 */
export function formatUSD(amount: number): string {
  return `US$${amount.toFixed(2)}`
}

/**
 * Formats time duration as HH:MM:SS, supporting > 24 hours without wrapping.
 */
export function formatHMS(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/**
 * Formats duration in hours and minutes for supporting summaries:
 * e.g. "2h 45m", "45m", or "30s"
 */
export function formatHoursMinutes(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  if (safeSeconds < 60) return `${safeSeconds}s`
  if (safeSeconds < 600 && safeSeconds % 60) return `${minutes}m ${safeSeconds % 60}s`
  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

/**
 * Formats estimated work remaining rounded upwards.
 * If 1 second is remaining, returns "1m" (or "1h 1m" if 3601s).
 */
export function formatEstimatedWork(remainingSeconds: number): string {
  if (remainingSeconds <= 0) return '0m'
  const totalMinutes = Math.ceil(remainingSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}
