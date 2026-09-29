import { describe, it, expect } from 'vitest'
import {
  calculateUsdEarned,
  calculateSessionValues,
  recalculateSessions,
  calculateProjectedSummary,
  formatGBP,
  formatHMS,
  formatEstimatedWork,
} from './calculations'
import type { Agreement, WorkSession } from '../types'

describe('Clocked calculations', () => {
  const testAgreement: Agreement = {
    id: 'test-agreement-1',
    sisterName: 'Sister',
    originalDebtGBP: 60.0,
    hourlyRateUSD: 6.0,
    exchangeRateUSDToGBP: 0.8, // US$1 = £0.80
    exchangeRateSource: 'Controlled test rate',
    exchangeRateDate: '2026-09-29',
    createdAt: '2026-09-29T10:00:00.000Z',
  }

  it('calculates USD earned correctly for 5m, 30m, 60m', () => {
    // 5 minutes = 300s -> $0.50
    expect(calculateUsdEarned(300, 6.0)).toBeCloseTo(0.5, 6)
    // 30 minutes = 1800s -> $3.00
    expect(calculateUsdEarned(1800, 6.0)).toBeCloseTo(3.0, 6)
    // 60 minutes = 3600s -> $6.00
    expect(calculateUsdEarned(3600, 6.0)).toBeCloseTo(6.0, 6)
  })

  it('calculates GBP credit at US$1 = £0.80 correctly', () => {
    // 5 mins: $0.50 * 0.80 = £0.40
    const { usdEarned, gbpCredit } = calculateSessionValues(300, 6.0, 0.8)
    expect(usdEarned).toBeCloseTo(0.5, 6)
    expect(gbpCredit).toBeCloseTo(0.4, 6)

    // 1 hour: $6.00 * 0.80 = £4.80
    const oneHour = calculateSessionValues(3600, 6.0, 0.8)
    expect(oneHour.usdEarned).toBeCloseTo(6.0, 6)
    expect(oneHour.gbpCredit).toBeCloseTo(4.8, 6)
  })

  it('ensures 12 five-minute sessions produce exactly the same total credit as one 60-minute session', () => {
    const twelveFiveMinSessions: WorkSession[] = Array.from({ length: 12 }, (_, i) => ({
      id: `session-5m-${i}`,
      agreementId: testAgreement.id,
      date: '2026-09-29',
      activeDurationSec: 300,
      usdEarned: 0,
      exchangeRate: 0.8,
      gbpCredit: 0,
      appliedGbp: 0,
      excessGbp: 0,
      createdAt: `2026-09-29T10:${i.toString().padStart(2, '0')}:00Z`,
    }))

    const oneHourSession: WorkSession[] = [
      {
        id: 'session-60m',
        agreementId: testAgreement.id,
        date: '2026-09-29',
        activeDurationSec: 3600,
        usdEarned: 0,
        exchangeRate: 0.8,
        gbpCredit: 0,
        appliedGbp: 0,
        excessGbp: 0,
        createdAt: '2026-09-29T10:00:00Z',
      },
    ]

    const result12 = recalculateSessions(twelveFiveMinSessions, testAgreement)
    const result1 = recalculateSessions(oneHourSession, testAgreement)

    // Total seconds worked must match exactly
    expect(result12.summary.totalSavedSeconds).toBe(3600)
    expect(result1.summary.totalSavedSeconds).toBe(3600)

    // Total credit must match identically
    expect(result12.summary.totalGbpCredit).toBeCloseTo(4.8, 8)
    expect(result1.summary.totalGbpCredit).toBeCloseTo(4.8, 8)
    expect(result12.summary.totalGbpCredit).toBe(result1.summary.totalGbpCredit)

    // Remaining debt must match identically
    expect(result12.summary.remainingDebt).toBeCloseTo(55.2, 8)
    expect(result1.summary.remainingDebt).toBeCloseTo(55.2, 8)
    expect(result12.summary.remainingDebt).toBe(result1.summary.remainingDebt)
  })

  it('preserves exact fractional pennies and avoids negative balance when work exceeds debt', () => {
    // 15 hours of work = 15 * 3600s = 54000s
    // At $6/hr and 0.80 rate, 1 hr = £4.80.
    // £60 / £4.80 = 12.5 hours = 45000 seconds to clear.
    // 15 hours should yield £72.00 total credit.
    // Remaining debt should be exactly £0.00, not negative!
    // Excess should be £12.00.
    const longSession: WorkSession[] = [
      {
        id: 'long-1',
        agreementId: testAgreement.id,
        date: '2026-09-29',
        activeDurationSec: 54000,
        usdEarned: 0,
        exchangeRate: 0.8,
        gbpCredit: 0,
        appliedGbp: 0,
        excessGbp: 0,
        createdAt: '2026-09-29T10:00:00Z',
      },
    ]

    const { summary } = recalculateSessions(longSession, testAgreement)
    expect(summary.totalGbpCredit).toBeCloseTo(72.0, 6)
    expect(summary.totalCreditApplied).toBeCloseTo(60.0, 6)
    expect(summary.remainingDebt).toBe(0)
    expect(summary.excessGbp).toBeCloseTo(12.0, 6)
    expect(summary.isAllSquare).toBe(true)
  })

  it('detects fractional penny (< £0.01) and does not declare debt cleared prematurely', () => {
    // Work 1 second short of clearing £60:
    // Rate: £4.80 / 3600s = £0.0013333333... per second.
    // 44999 seconds worked:
    // Credit = 44999 * (6 * 0.8 / 3600) = 44999 * 0.0013333333... = 59.998666...
    // Remaining debt = 60 - 59.998666... = 0.001333... (£0.00133)
    // In ordinary rounding to 2 decimals, 0.00133 would round to 0.00!
    // But the debt is NOT cleared!
    const session: WorkSession[] = [
      {
        id: 'sub-penny',
        agreementId: testAgreement.id,
        date: '2026-09-29',
        activeDurationSec: 44999,
        usdEarned: 0,
        exchangeRate: 0.8,
        gbpCredit: 0,
        appliedGbp: 0,
        excessGbp: 0,
        createdAt: '2026-09-29T10:00:00Z',
      },
    ]

    const { summary } = recalculateSessions(session, testAgreement)
    expect(summary.remainingDebt).toBeGreaterThan(0)
    expect(summary.remainingDebt).toBeLessThan(0.01)
    expect(summary.isLessThanOnePenny).toBe(true)
    expect(summary.isAllSquare).toBe(false)
    expect(formatGBP(summary.remainingDebt, { allowLessThanPenny: true })).toBe('Less than £0.01')
  })

  it('correctly calculates projected balance during pending active session', () => {
    const emptySessions: WorkSession[] = []
    const { summary: savedSummary } = recalculateSessions(emptySessions, testAgreement)

    // User is running a 5-minute session (300s)
    const projected = calculateProjectedSummary(savedSummary, 300, testAgreement)

    expect(projected.projectedCredit).toBeCloseTo(0.4, 6)
    expect(projected.projectedRemaining).toBeCloseTo(59.6, 6)
    expect(projected.isAllSquare).toBe(false)

    // User runs 12.5 hours (45000s) -> reaches target!
    const targetProjected = calculateProjectedSummary(savedSummary, 45000, testAgreement)
    expect(targetProjected.projectedRemaining).toBe(0)
    expect(targetProjected.isAllSquare).toBe(true)
  })

  it('rounds estimated work remaining upwards', () => {
    // 1 second needed:
    expect(formatEstimatedWork(1)).toBe('1m')
    // 59 seconds:
    expect(formatEstimatedWork(59)).toBe('1m')
    // 61 seconds:
    expect(formatEstimatedWork(61)).toBe('2m')
    // 3601 seconds:
    expect(formatEstimatedWork(3601)).toBe('1h 1m')
  })

  it('formats duration beyond 24 hours without wrapping', () => {
    // 25 hours, 14 minutes, 30 seconds
    const seconds = 25 * 3600 + 14 * 60 + 30
    expect(formatHMS(seconds)).toBe('25:14:30')

    // 100 hours
    const hundredHours = 100 * 3600 + 5 * 60 + 7
    expect(formatHMS(hundredHours)).toBe('100:05:07')
  })
})
