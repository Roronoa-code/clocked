import type { Agreement, WorkSession, ActiveSession, AppSettings } from '../types'
import { validateClockedData } from './validateState'

const STORAGE_KEYS = {
  AGREEMENT: 'clocked_v1_agreement',
  SESSIONS: 'clocked_v1_sessions',
  ACTIVE_SESSION: 'clocked_v1_active_session',
  ARCHIVES: 'clocked_v1_archives',
  SETTINGS: 'clocked_v1_settings',
} as const

// BroadcastChannel for instant multi-tab synchronization
let syncChannel: BroadcastChannel | null = null
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('clocked_channel')
  }
} catch {
  // Graceful fallback if BroadcastChannel is blocked
  syncChannel = null
}

export type SyncMessage =
  | { type: 'ACTIVE_SESSION_UPDATE'; activeSession: ActiveSession | null }
  | { type: 'SESSIONS_UPDATE'; sessions: WorkSession[] }
  | { type: 'AGREEMENT_UPDATE'; agreement: Agreement | null }

export function broadcastMessage(message: SyncMessage) {
  try {
    syncChannel?.postMessage(message)
  } catch (err) {
    console.warn('Failed to broadcast sync message', err)
  }
}

export function subscribeToSync(handler: (message: SyncMessage) => void): () => void {
  if (!syncChannel) return () => {}
  const listener = (event: MessageEvent) => {
    handler(event.data)
  }
  syncChannel.addEventListener('message', listener)
  return () => {
    syncChannel?.removeEventListener('message', listener)
  }
}

/* Agreement storage */
export function loadAgreement(): Agreement | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AGREEMENT)
    if (!raw) return null
    return JSON.parse(raw) as Agreement
  } catch (err) {
    console.error('Error loading agreement from localStorage', err)
    return null
  }
}

export function saveAgreement(agreement: Agreement): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.AGREEMENT, JSON.stringify(agreement))
    broadcastMessage({ type: 'AGREEMENT_UPDATE', agreement })
    return true
  } catch (err) {
    console.error('Error saving agreement to localStorage', err)
    return false
  }
}

/* Sessions storage */
export function loadSessions(): WorkSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS)
    if (!raw) return []
    return JSON.parse(raw) as WorkSession[]
  } catch (err) {
    console.error('Error loading sessions from localStorage', err)
    return []
  }
}

export function saveSessions(sessions: WorkSession[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions))
    broadcastMessage({ type: 'SESSIONS_UPDATE', sessions })
    return true
  } catch (err) {
    console.error('Error saving sessions to localStorage', err)
    return false
  }
}

/* Active Session storage */
export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION)
    if (!raw) return null
    return JSON.parse(raw) as ActiveSession
  } catch (err) {
    console.error('Error loading active session from localStorage', err)
    return null
  }
}

export function saveActiveSession(activeSession: ActiveSession | null): boolean {
  try {
    if (activeSession === null) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION)
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(activeSession))
    }
    broadcastMessage({ type: 'ACTIVE_SESSION_UPDATE', activeSession })
    return true
  } catch (err) {
    console.error('Error saving active session to localStorage', err)
    return false
  }
}

/* Archives storage */
export function loadArchives(): { agreement: Agreement; sessions: WorkSession[] }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ARCHIVES)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (err) {
    console.error('Error loading archives from localStorage', err)
    return []
  }
}

export function saveArchives(archives: { agreement: Agreement; sessions: WorkSession[] }[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.ARCHIVES, JSON.stringify(archives))
    return true
  } catch (err) {
    console.error('Error saving archives to localStorage', err)
    return false
  }
}

/* Settings storage */
export function loadSettings(): AppSettings {
  const defaultSettings: AppSettings = {
    reducedMotion: 'system',
    showExcessDetails: true,
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: AppSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

/* Export / Import Backup */
export interface BackupData {
  version: 1
  exportedAt: string
  agreement: Agreement | null
  sessions: WorkSession[]
  archives: { agreement: Agreement; sessions: WorkSession[] }[]
  activeSession: ActiveSession | null
}

export function generateExportJSON(override?: Omit<BackupData, 'version' | 'exportedAt'>): string {
  const data: BackupData = override ? {
    version: 1,
    exportedAt: new Date().toISOString(),
    ...override,
  } : {
    version: 1,
    exportedAt: new Date().toISOString(),
    agreement: loadAgreement(),
    sessions: loadSessions(),
    archives: loadArchives(),
    activeSession: loadActiveSession(),
  }
  return JSON.stringify(data, null, 2)
}

export function downloadBackupFile(override?: Omit<BackupData, 'version' | 'exportedAt'>) {
  const jsonStr = generateExportJSON(override)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const dateStr = new Date().toISOString().split('T')[0]
  a.href = url
  a.download = `clocked-backup-${dateStr}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function parseAndValidateBackup(jsonString: string): { valid: boolean; data?: BackupData; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)
    const normalizeDate = (agreement: any) => {
      if (!agreement || typeof agreement.exchangeRateDate !== 'string' || /^\d{4}-\d{2}-\d{2}$/.test(agreement.exchangeRateDate)) return
      const timestamp = Date.parse(agreement.exchangeRateDate)
      if (Number.isFinite(timestamp)) agreement.exchangeRateDate = new Date(timestamp).toISOString().slice(0, 10)
    }
    normalizeDate(parsed?.agreement)
    if (Array.isArray(parsed?.archives)) parsed.archives.forEach((entry: any) => normalizeDate(entry?.agreement))
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1
      || typeof parsed.exportedAt !== 'string' || !Number.isFinite(Date.parse(parsed.exportedAt))
      || !validateClockedData({
        agreement: parsed.agreement,
        sessions: parsed.sessions,
        archives: parsed.archives,
        activeSession: parsed.activeSession,
        settings: { reducedMotion: 'system', showExcessDetails: true },
      })) return { valid: false, error: 'This backup has missing or invalid Clocked records.' }
    return { valid: true, data: parsed as BackupData }
  } catch {
    return { valid: false, error: 'Invalid JSON format.' }
  }
}

export function restoreBackup(data: BackupData): boolean {
  if (!parseAndValidateBackup(JSON.stringify(data)).valid) return false
  const keys = [STORAGE_KEYS.AGREEMENT, STORAGE_KEYS.SESSIONS, STORAGE_KEYS.ARCHIVES, STORAGE_KEYS.ACTIVE_SESSION]
  const previous = keys.map(key => localStorage.getItem(key))
  try {
    if (data.agreement === null) localStorage.removeItem(STORAGE_KEYS.AGREEMENT)
    else localStorage.setItem(STORAGE_KEYS.AGREEMENT, JSON.stringify(data.agreement))
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions))
    localStorage.setItem(STORAGE_KEYS.ARCHIVES, JSON.stringify(data.archives))
    if (data.activeSession === null) localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION)
    else localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(data.activeSession))
    broadcastMessage({ type: 'AGREEMENT_UPDATE', agreement: data.agreement })
    broadcastMessage({ type: 'SESSIONS_UPDATE', sessions: data.sessions })
    broadcastMessage({ type: 'ACTIVE_SESSION_UPDATE', activeSession: data.activeSession })
    return true
  } catch (err) {
    try {
      keys.forEach((key, index) => {
        if (previous[index] === null) localStorage.removeItem(key)
        else localStorage.setItem(key, previous[index]!)
      })
    } catch (rollbackError) {
      console.error('Failed to roll back a local restore', rollbackError)
    }
    console.error('Failed to restore backup', err)
    return false
  }
}
