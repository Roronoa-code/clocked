import type { ClockedData } from './validateState'

export type Party = 'abdul' | 'daremo'
export interface VersionedData { version: number; data: ClockedData }

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function response<T>(request: Promise<Response>): Promise<T> {
  const result = await request
  const body = await result.json().catch(() => ({}))
  if (!result.ok) throw new ApiError(body.error || `Request failed (${result.status})`, result.status)
  return body as T
}

const options: RequestInit = { credentials: 'same-origin', cache: 'no-store' }

export async function currentParty(): Promise<Party | null> {
  const value = await response<{ party: Party | null }>(fetch('/api/session', options))
  return value.party
}

export async function signIn(party: Party, pin: string): Promise<void> {
  await response(fetch('/api/session', {
    ...options,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ party, pin }),
  }))
}

export async function signOut(): Promise<void> {
  await response(fetch('/api/session', { ...options, method: 'DELETE' }))
}

export function readRemoteData(): Promise<VersionedData> {
  return response(fetch('/api/state', options))
}

export async function writeRemoteData(current: VersionedData, data: ClockedData): Promise<VersionedData> {
  return response(fetch('/api/state', {
    ...options,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: current.version, data }),
  }))
}
