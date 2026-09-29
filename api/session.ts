/// <reference types="node" />
import { addressHash, clearSessionCookie, db, json, partyFromRequest, sameOrigin, sessionCookie, type Party } from './_shared.js'

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === 'GET') return json({ party: partyFromRequest(request) })
      if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403)
      if (request.method === 'DELETE') {
        return json({ party: null }, 200, { 'Set-Cookie': clearSessionCookie() })
      }
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

      const input = await request.json().catch(() => null) as { party?: unknown; pin?: unknown } | null
      const party = input?.party
      const pin = input?.pin
      if ((party !== 'abdul' && party !== 'daremo') || typeof pin !== 'string' || !/^\d{4,12}$/.test(pin)) {
        return json({ error: 'Choose a person and enter a valid PIN.' }, 400)
      }
      const expected = process.env[party === 'abdul' ? 'CLOCKED_PIN_ABDUL' : 'CLOCKED_PIN_DAREMO']?.trim()
      if (!expected) throw new Error('Clocked PIN is missing')
      const valid = equalPin(pin, expected)
      const result = await db('rpc/clocked_register_login', {
        method: 'POST',
        body: JSON.stringify({ p_party: party, p_address_hash: addressHash(request), p_valid: valid }),
      })
      if (!result.ok) throw new Error(`PIN throttling failed: ${result.status}`)
      const allowed = await result.json() === true
      if (!allowed) return json({ error: 'Incorrect PIN or temporarily locked. Try again later.' }, 401)
      return json({ party }, 200, { 'Set-Cookie': sessionCookie(party as Party) })
    } catch (error) {
      console.error('Clocked session request failed', error)
      return json({ error: 'Sign-in is unavailable. Please try again.' }, 503)
    }
  },
}

function equalPin(a: string, b: string): boolean {
  // Compare every byte even after a mismatch so the PIN comparison has stable work.
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  let difference = left.length ^ right.length
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) difference |= (left[i] ?? 0) ^ (right[i] ?? 0)
  return difference === 0
}
