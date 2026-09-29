// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import session from '../../api/session.js'
import state from '../../api/state.js'
import { emptyClockedData, validateClockedData } from './validateState.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('requires a signed PIN session and rejects stale writes', async () => {
  vi.stubEnv('CLOCKED_SESSION_SECRET', 'a-long-test-secret-that-is-at-least-thirty-two-bytes')
  vi.stubEnv('CLOCKED_PIN_ABDUL', '1234')
  vi.stubEnv('SUPABASE_URL', 'https://database.example')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes('rpc/clocked_register_login')) {
      const payload = JSON.parse(String(init.body))
      return Response.json(payload.p_valid)
    }
    if (init.method === 'PATCH') return Response.json([])
    return Response.json([{ version: 0, data: emptyClockedData }])
  }))

  const base = 'https://clocked.example'
  expect((await state.fetch(new Request(`${base}/api/state`))).status).toBe(401)
  const wrong = await session.fetch(new Request(`${base}/api/session`, {
    method: 'POST', headers: { origin: base }, body: JSON.stringify({ party: 'abdul', pin: '9999' }),
  }))
  expect(wrong.status).toBe(401)
  const login = await session.fetch(new Request(`${base}/api/session`, {
    method: 'POST', headers: { origin: base }, body: JSON.stringify({ party: 'abdul', pin: '1234' }),
  }))
  expect(login.status).toBe(200)
  const cookie = login.headers.get('set-cookie')!
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('SameSite=Strict')
  const headers = { cookie, origin: base }
  expect((await state.fetch(new Request(`${base}/api/state`, { headers }))).status).toBe(200)
  expect((await state.fetch(new Request(`${base}/api/state`, {
    method: 'PUT', headers, body: '{bad',
  }))).status).toBe(400)
  const stale = await state.fetch(new Request(`${base}/api/state`, {
    method: 'PUT', headers,
    body: JSON.stringify({ version: 0, data: emptyClockedData }),
  }))
  expect(stale.status).toBe(409)
})

it('lets Daremo save work but not replace the agreement or settings', async () => {
  vi.stubEnv('CLOCKED_SESSION_SECRET', 'a-long-test-secret-that-is-at-least-thirty-two-bytes')
  vi.stubEnv('CLOCKED_PIN_DAREMO', '5678')
  vi.stubEnv('SUPABASE_URL', 'https://database.example')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key')
  const agreement = {
    id: 'agreement-1', sisterName: 'Daremo', originalDebtGBP: 60,
    hourlyRateUSD: 6, exchangeRateUSDToGBP: 0.8, exchangeRateSource: 'Agreed',
    exchangeRateDate: '2026-09-29', createdAt: '2026-09-29T10:00:00.000Z',
    completedAt: null,
  }
  const stored = { version: 0, data: { ...emptyClockedData, agreement } }
  const writes: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes('rpc/clocked_register_login')) return Response.json(true)
    if (init.method === 'PATCH') {
      const data = JSON.parse(String(init.body)).data
      writes.push(data)
      return Response.json([{ version: 1, data }])
    }
    return Response.json([stored])
  }))

  const base = 'https://clocked.example'
  const login = await session.fetch(new Request(`${base}/api/session`, {
    method: 'POST', headers: { origin: base }, body: JSON.stringify({ party: 'daremo', pin: '5678' }),
  }))
  const headers = { cookie: login.headers.get('set-cookie')!, origin: base }
  const write = (data: unknown) => state.fetch(new Request(`${base}/api/state`, {
    method: 'PUT', headers, body: JSON.stringify({ version: 0, data }),
  }))

  expect((await write({ ...stored.data, settings: { reducedMotion: true, showExcessDetails: true } })).status).toBe(403)
  expect((await write({ ...stored.data, agreement: { ...agreement, originalDebtGBP: 1 } })).status).toBe(403)
  expect((await write({ ...stored.data, sessions: [{
    id: 'forged', agreementId: agreement.id, date: '2026-09-29', activeDurationSec: 300,
    usdEarned: 10, hourlyRateUSD: 120, exchangeRate: 0.8, gbpCredit: 8,
    appliedGbp: 8, excessGbp: 0, createdAt: '2026-09-29T11:00:00.000Z',
  }] })).status).toBe(403)
  expect(writes).toHaveLength(0)

  const sessionRecord = {
    id: 'work-1', agreementId: agreement.id, date: '2026-09-29', activeDurationSec: 300,
    usdEarned: 0.5, hourlyRateUSD: 6, exchangeRate: 0.8, gbpCredit: 0.4,
    appliedGbp: 0, excessGbp: 0, createdAt: '2026-09-29T11:00:00.000Z',
  }
  expect((await write({ ...stored.data, sessions: [sessionRecord] })).status).toBe(200)
  expect(writes).toHaveLength(1)
  expect((writes[0] as typeof stored.data).sessions[0].appliedGbp).toBe(0.4)
})

it('rejects an active timer already present in saved sessions', () => {
  const agreement = {
    id: 'agreement-1', sisterName: 'Daremo', originalDebtGBP: 60,
    hourlyRateUSD: 6, exchangeRateUSDToGBP: 0.8, exchangeRateSource: 'Agreed',
    exchangeRateDate: '2026-09-29', createdAt: '2026-09-29T10:00:00.000Z',
  }
  expect(validateClockedData({ ...emptyClockedData, agreement,
    sessions: [{ id: 'same', agreementId: agreement.id, date: '2026-09-29', activeDurationSec: 1,
      usdEarned: 0.00166667, hourlyRateUSD: 6, exchangeRate: 0.8,
      gbpCredit: 0.00133334, appliedGbp: 0, excessGbp: 0, createdAt: agreement.createdAt }],
    activeSession: { id: 'same', agreementId: agreement.id, startedAt: Date.now(),
      activeDurationMs: 1000, currentRunStartedAt: null, status: 'paused', taskNote: '' },
  })).toBe(false)
})
