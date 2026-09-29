import { db, json, partyFromRequest, sameOrigin } from './_shared.js'
import { validateClockedData } from '../src/utils/validateState.js'
import { recalculateSessions } from '../src/utils/calculations.js'
import type { ClockedData } from '../src/utils/validateState.js'

function daremoCanWrite(before: ClockedData, after: ClockedData): boolean {
  if (!before.agreement || !after.agreement) return false
  const { completedAt: beforeCompleted, ...beforeTerms } = before.agreement
  const { completedAt: afterCompleted, ...afterTerms } = after.agreement
  if (JSON.stringify(beforeTerms) !== JSON.stringify(afterTerms)
    || JSON.stringify(before.archives) !== JSON.stringify(after.archives)
    || JSON.stringify(before.settings) !== JSON.stringify(after.settings)) return false

  const previousSessions = new Map(before.sessions.map(session => [session.id, session]))
  for (const session of after.sessions) {
    const previous = previousSessions.get(session.id)
    if (!previous) {
      if (session.hourlyRateUSD !== before.agreement.hourlyRateUSD
        || session.exchangeRate !== before.agreement.exchangeRateUSDToGBP) return false
    } else if (session.hourlyRateUSD !== previous.hourlyRateUSD
      || session.exchangeRate !== previous.exchangeRate
      || session.createdAt !== previous.createdAt
      || session.startTime !== previous.startTime
      || previous.hourlyRateUSD === undefined && (
        Math.abs(session.usdEarned - previous.usdEarned * session.activeDurationSec / previous.activeDurationSec) > 1e-6
        || Math.abs(session.gbpCredit - previous.gbpCredit * session.activeDurationSec / previous.activeDurationSec) > 1e-6
      )) return false
  }

  const cleared = recalculateSessions(after.sessions, before.agreement).summary.isAllSquare
  return cleared ? (beforeCompleted ? afterCompleted === beforeCompleted : !!afterCompleted)
    : afterCompleted == null
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const party = partyFromRequest(request)
      if (!party) return json({ error: 'Sign in to continue.' }, 401)
      if (request.method === 'GET') {
        const result = await db('clocked_state?id=eq.1&select=version,data')
        if (!result.ok) throw new Error(`State read failed: ${result.status}`)
        const rows = await result.json()
        if (!Array.isArray(rows) || rows.length !== 1 || !validateClockedData(rows[0].data)) throw new Error('Clocked state is missing or invalid')
        return json({ version: rows[0].version, data: rows[0].data })
      }
      if (request.method !== 'PUT') return json({ error: 'Method not allowed.' }, 405)
      if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403)
      const body = await request.text()
      if (body.length > 2_000_000) return json({ error: 'Clocked data is too large.' }, 413)
      let input: { version?: unknown; data?: unknown }
      try { input = JSON.parse(body) }
      catch { return json({ error: 'Invalid JSON.' }, 400) }
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid Clocked data.' }, 400)
      if (!Number.isSafeInteger(input.version) || (input.version as number) < 0 || !validateClockedData(input.data)) {
        return json({ error: 'Invalid Clocked data.' }, 400)
      }
      const expected = input.version as number
      if (party === 'daremo') {
        const previous = await db('clocked_state?id=eq.1&select=version,data')
        if (!previous.ok) throw new Error(`State read failed: ${previous.status}`)
        const rows = await previous.json()
        if (!Array.isArray(rows) || rows.length !== 1 || !validateClockedData(rows[0].data)) throw new Error('Clocked state is missing or invalid')
        if (rows[0].version !== expected) return json({ error: 'This data changed on another device. Reload and try again.' }, 409)
        if (!daremoCanWrite(rows[0].data, input.data)) return json({ error: 'Only Abdul can change the agreement or settings.' }, 403)
      }
      const data = input.data as ClockedData
      if (data.agreement) data.sessions = recalculateSessions(data.sessions, data.agreement).recalculatedSessions
      const result = await db(`clocked_state?id=eq.1&version=eq.${expected}&select=version,data`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ version: expected + 1, data, updated_by: party, updated_at: new Date().toISOString() }),
      })
      if (!result.ok) throw new Error(`State write failed: ${result.status}`)
      const rows = await result.json()
      if (!Array.isArray(rows) || rows.length !== 1) return json({ error: 'This data changed on another device. Reload and try again.' }, 409)
      return json({ version: rows[0].version, data: rows[0].data })
    } catch (error) {
      console.error('Clocked state request failed', error)
      return json({ error: 'Could not reach the database. Your changes were not saved.' }, 503)
    }
  },
}
