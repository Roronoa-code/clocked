import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveAgreement,
  loadAgreement,
  saveSessions,
  loadSessions,
  saveActiveSession,
  loadActiveSession,
  generateExportJSON,
  parseAndValidateBackup,
  restoreBackup,
} from './storage'
import type { Agreement, WorkSession, ActiveSession } from '../types'

describe('Storage and Backup', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const testAgreement: Agreement = {
    id: 'ag-1',
    sisterName: 'Sister',
    originalDebtGBP: 60,
    hourlyRateUSD: 6,
    exchangeRateUSDToGBP: 0.8,
    exchangeRateSource: 'Test',
    exchangeRateDate: '2026-09-29',
    createdAt: '2026-09-29T10:00:00Z',
  }

  const testSessions: WorkSession[] = [
    {
      id: 's-1',
      agreementId: 'ag-1',
      date: '2026-09-29',
      activeDurationSec: 300,
      usdEarned: 0.5,
      exchangeRate: 0.8,
      gbpCredit: 0.4,
      appliedGbp: 0.4,
      excessGbp: 0,
      createdAt: '2026-09-29T10:05:00Z',
    },
  ]

  it('persists and loads agreement correctly', () => {
    expect(loadAgreement()).toBeNull()
    saveAgreement(testAgreement)
    const loaded = loadAgreement()
    expect(loaded).toEqual(testAgreement)
  })

  it('persists and loads sessions correctly', () => {
    expect(loadSessions()).toEqual([])
    saveSessions(testSessions)
    const loaded = loadSessions()
    expect(loaded).toEqual(testSessions)
  })

  it('persists, updates and clears active session', () => {
    expect(loadActiveSession()).toBeNull()
    const active: ActiveSession = {
      id: 'act-1',
      agreementId: 'ag-1',
      startedAt: 1000,
      activeDurationMs: 5000,
      currentRunStartedAt: 6000,
      status: 'running',
      taskNote: 'Tidying room',
    }
    saveActiveSession(active)
    expect(loadActiveSession()).toEqual(active)

    // Clear active session
    saveActiveSession(null)
    expect(loadActiveSession()).toBeNull()
  })

  it('generates valid JSON export and restores correctly', () => {
    saveAgreement(testAgreement)
    saveSessions(testSessions)

    const json = generateExportJSON()
    const { valid, data, error } = parseAndValidateBackup(json)

    expect(valid).toBe(true)
    expect(error).toBeUndefined()
    expect(data?.agreement).toEqual(testAgreement)
    expect(data?.sessions).toEqual(testSessions)

    // Clear and restore
    localStorage.clear()
    expect(loadAgreement()).toBeNull()
    expect(loadSessions()).toEqual([])

    const restored = restoreBackup(data!)
    expect(restored).toBe(true)
    expect(loadAgreement()).toEqual(testAgreement)
    expect(loadSessions()).toEqual(testSessions)
  })

  it('rejects invalid or corrupted JSON backup', () => {
    const invalid = parseAndValidateBackup('{ not valid json')
    expect(invalid.valid).toBe(false)
    expect(invalid.error).toBeDefined()

    const missingSessions = parseAndValidateBackup('{"version": 1}')
    expect(missingSessions.valid).toBe(false)
  })
})
