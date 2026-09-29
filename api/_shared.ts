/// <reference types="node" />
import { createHmac, timingSafeEqual } from 'node:crypto'

export type Party = 'abdul' | 'halimah'
const cookieName = 'clocked_who'
const maxAgeSeconds = 30 * 24 * 60 * 60

export function json(value: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', Vary: 'Cookie', ...headers },
  })
}

function secret(): string {
  const value = process.env.CLOCKED_SESSION_SECRET
  if (!value || value.length < 32) throw new Error('Clocked session secret is missing')
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function partyFromRequest(request: Request): Party | null {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  if (!token) return null
  const [party, issuedRaw, signature, extra] = token.split('.')
  if (extra || (party !== 'abdul' && party !== 'halimah')) return null
  const issued = Number(issuedRaw)
  const now = Date.now()
  if (!Number.isInteger(issued) || issued <= 0 || issued > now + 300_000 || now - issued > maxAgeSeconds * 1000) return null
  return equal(signature ?? '', sign(`${party}.${issuedRaw}`)) ? party : null
}

export function sessionCookie(party: Party): string {
  const payload = `${party}.${Date.now()}`
  return `${cookieName}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${maxAgeSeconds}`
}

export function clearSessionCookie(): string {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}

function dbConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Clocked database is not configured')
  return { url, key }
}

export async function db(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, key } = dbConfig()
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    cache: 'no-store',
  })
}

export function addressHash(request: Request): string {
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || 'unknown'
  return createHmac('sha256', secret()).update(address).digest('hex')
}
