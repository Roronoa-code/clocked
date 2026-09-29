// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import session from '../../api/session.js'
import state from '../../api/state.js'
import { emptyClockedData } from './validateState.js'

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
