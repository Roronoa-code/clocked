import type { Agreement, WorkSession, ActiveSession, AppSettings } from '../types'

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

export function generateExportJSON(): string {
  const data: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    agreement: loadAgreement(),
    sessions: loadSessions(),
    archives: loadArchives(),
    activeSession: loadActiveSession(),
  }
  return JSON.stringify(data, null, 2)
}

export function downloadBackupFile() {
  const jsonStr = generateExportJSON()
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
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'File is not a valid JSON object.' }
    }
    if (!('sessions' in parsed) || !Array.isArray(parsed.sessions)) {
      return { valid: false, error: 'Backup is missing sessions list.' }
    }
    return { valid: true, data: parsed as BackupData }
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Invalid JSON format.' }
  }
}

export function restoreBackup(data: BackupData): boolean {
  try {
    if (data.agreement) {
      saveAgreement(data.agreement)
    }
    if (data.sessions) {
      saveSessions(data.sessions)
    }
    if (data.archives) {
      saveArchives(data.archives)
    }
    if (data.activeSession) {
      saveActiveSession(data.activeSession)
    }
    return true
  } catch (err) {
    console.error('Failed to restore backup', err)
    return false
  }
}
