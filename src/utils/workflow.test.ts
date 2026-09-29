import { describe, it, expect } from 'vitest'
import {
  calculateSessionValues,
  recalculateSessions,
  calculateProjectedSummary,
  formatEstimatedWork,
} from './calculations'
import type { Agreement, WorkSession } from '../types'

describe('Full Agreement Workflow & Accounting Integrity', () => {
  const agreement: Agreement = {
    id: 'agreement-workflow-test',
    sisterName: 'Sister',
    originalDebtGBP: 60.0,
    hourlyRateUSD: 6.0,
    exchangeRateUSDToGBP: 0.8, // US$1 = £0.80
    exchangeRateSource: 'Controlled test rate',
    exchangeRateDate: '2026-09-29',
    createdAt: '2026-09-29T09:00:00Z',
  }

  it('verifies the specification controlled test case (US$1 = £0.80, 5 mins = $0.50, £0.40 credit, £59.60 balance)', () => {
    // 5 minutes active work = 300 seconds
    const { usdEarned, gbpCredit } = calculateSessionValues(300, 6.0, 0.8)
    expect(usdEarned).toBe(0.5)
    expect(gbpCredit).toBe(0.4)

    const session1: WorkSession = {
      id: 'session-1',
      agreementId: agreement.id,
      date: '2026-09-29',
      activeDurationSec: 300,
      taskNote: 'Tidying the kitchen',
      usdEarned,
      exchangeRate: 0.8,
      gbpCredit,
      appliedGbp: 0,
      excessGbp: 0,
      createdAt: '2026-09-29T10:00:00Z',
    }

    const { recalculatedSessions, summary } = recalculateSessions([session1], agreement)

    expect(recalculatedSessions[0].appliedGbp).toBe(0.4)
    expect(recalculatedSessions[0].excessGbp).toBe(0)
    expect(summary.totalSavedSeconds).toBe(300)
    expect(summary.totalUsdEarned).toBe(0.5)
    expect(summary.totalGbpCredit).toBe(0.4)
    expect(summary.totalCreditApplied).toBe(0.4)
    expect(summary.remainingDebt).toBe(59.6)
    expect(summary.isAllSquare).toBe(false)
  })

  it('demonstrates editing a session consistently updates all dependent totals and debt balance', () => {
    // Initial: two sessions: 300s (£0.40) and 1800s (£2.40)
    const s1: WorkSession = {
      id: 's1',
      agreementId: agreement.id,
      date: '2026-09-29',
      activeDurationSec: 300,
      usdEarned: 0.5,
      hourlyRateUSD: 6,
      exchangeRate: 0.8,
      gbpCredit: 0.4,
      appliedGbp: 0.4,
      excessGbp: 0,
      createdAt: '2026-09-29T10:00:00Z',
    }

    const s2: WorkSession = {
      id: 's2',
      agreementId: agreement.id,
      date: '2026-09-29',
      activeDurationSec: 1800,
      usdEarned: 3.0,
      hourlyRateUSD: 6,
      exchangeRate: 0.8,
      gbpCredit: 2.4,
      appliedGbp: 2.4,
      excessGbp: 0,
      createdAt: '2026-09-29T11:00:00Z',
    }

    const initial = recalculateSessions([s1, s2], agreement)
    expect(initial.summary.remainingDebt).toBe(57.2) // 60 - 2.80 = 57.20
    expect(initial.summary.totalSavedSeconds).toBe(2100)

    // Now edit s1: increased duration from 300s (5m) to 3600s (1 hour, £4.80)
    const editedS1: WorkSession = {
      ...s1,
      activeDurationSec: 3600,
    }

    const afterEdit = recalculateSessions([editedS1, s2], agreement)
    expect(afterEdit.summary.totalSavedSeconds).toBe(5400) // 1.5 hours
    expect(afterEdit.summary.totalUsdEarned).toBe(9.0) // 6 + 3 = 9 USD
    expect(afterEdit.summary.totalGbpCredit).toBe(7.2) // 4.80 + 2.40 = 7.20 GBP
    expect(afterEdit.summary.remainingDebt).toBe(52.8) // 60 - 7.20 = 52.80
  })

  it('demonstrates deleting a session restores remaining debt consistently', () => {
    const s1: WorkSession = {
      id: 's1',
      agreementId: agreement.id,
      date: '2026-09-29',
      activeDurationSec: 3600,
      usdEarned: 6.0,
      exchangeRate: 0.8,
      gbpCredit: 4.8,
      appliedGbp: 4.8,
      excessGbp: 0,
      createdAt: '2026-09-29T10:00:00Z',
    }

    const s2: WorkSession = {
      id: 's2',
      agreementId: agreement.id,
      date: '2026-09-29',
      activeDurationSec: 1800,
      usdEarned: 3.0,
      exchangeRate: 0.8,
      gbpCredit: 2.4,
      appliedGbp: 2.4,
      excessGbp: 0,
      createdAt: '2026-09-29T11:00:00Z',
    }

    const beforeDelete = recalculateSessions([s1, s2], agreement)
    expect(beforeDelete.summary.remainingDebt).toBe(52.8)

    // Delete s1, keep only s2
    const afterDelete = recalculateSessions([s2], agreement)
    expect(afterDelete.summary.totalSavedSeconds).toBe(1800)
    expect(afterDelete.summary.totalGbpCredit).toBe(2.4)
    expect(afterDelete.summary.remainingDebt).toBe(57.6)
  })

  it('handles completion and excess work without negative balance', () => {
    // Sister works 13 hours total: 13 * 3600s = 46800s.
    // 13 * $6 = $78 USD.
    // At 0.80 rate = £62.40 GBP credit.
    // Debt target is £60.
    // Exactly £60 applied to debt, £2.40 excess. Remaining debt is 0.00.
    const session: WorkSession = {
      id: 'completion-session',
      agreementId: agreement.id,
      date: '2026-09-29',
      activeDurationSec: 46800,
      usdEarned: 78.0,
      exchangeRate: 0.8,
      gbpCredit: 62.4,
      appliedGbp: 0,
      excessGbp: 0,
      createdAt: '2026-09-29T10:00:00Z',
    }

    const { recalculatedSessions, summary } = recalculateSessions([session], agreement)

    expect(summary.totalGbpCredit).toBe(62.4)
    expect(summary.totalCreditApplied).toBe(60.0)
    expect(summary.remainingDebt).toBe(0)
    expect(summary.excessGbp).toBe(2.4)
    expect(summary.isAllSquare).toBe(true)
    expect(recalculatedSessions[0].appliedGbp).toBe(60.0)
    expect(recalculatedSessions[0].excessGbp).toBe(2.4)
  })

  it('verifies projected remaining balance updates live during session', () => {
    const { summary: savedSummary } = recalculateSessions([], agreement)
    expect(savedSummary.remainingDebt).toBe(60)

    // Projected after 30 mins active (1800s)
    const projected = calculateProjectedSummary(savedSummary, 1800, agreement)
    expect(projected.projectedCredit).toBe(2.4)
    expect(projected.projectedRemaining).toBe(57.6)
    expect(projected.isAllSquare).toBe(false)
    expect(formatEstimatedWork(projected.estimatedSecondsRemaining)).toBe('12h')
  })
})
