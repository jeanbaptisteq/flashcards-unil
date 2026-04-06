import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const CARD_STATE_STORAGE_KEY = 'flashcards_unil_v1'
const EXAM_SETTINGS_STORAGE_KEY = 'flashcards_unil_exam_v1'
const LOCAL_UPDATED_AT_STORAGE_KEY = 'flashcards_unil_local_updated_at_v1'
const SYNC_INITIALIZED_KEY = 'flashcards_unil_sync_initialized_v1'
const REMOTE_STATE_KEY = 'flashcards-unil'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

interface CloudSnapshot {
  version: 1
  updatedAt: string
  cardState: string
  examSettings: string
}

type SyncState = 'idle' | 'syncing' | 'ok' | 'error' | 'unavailable'

export interface CloudSyncStatus {
  state: SyncState
  message: string
}

const syncStatus: CloudSyncStatus = {
  state: 'idle',
  message: '',
}

type Listener = (status: CloudSyncStatus) => void

const listeners = new Set<Listener>()

let supabase: SupabaseClient | null = null
let autoPushTimer: ReturnType<typeof setTimeout> | null = null
let autoPullTimer: ReturnType<typeof setInterval> | null = null
let syncAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

function emitStatus(next: Partial<CloudSyncStatus>): void {
  Object.assign(syncStatus, next)
  for (const listener of listeners) listener({ ...syncStatus })
}

function setUnavailable(message = 'Synchronisation Supabase indisponible.'): void {
  syncAvailable = false
  if (autoPushTimer) {
    clearTimeout(autoPushTimer)
    autoPushTimer = null
  }
  if (autoPullTimer) {
    clearInterval(autoPullTimer)
    autoPullTimer = null
  }
  emitStatus({ state: 'unavailable', message })
}

function getClient(): SupabaseClient {
  if (!syncAvailable) {
    throw new Error('Supabase sync is unavailable.')
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return supabase
}

function nowIso(): string {
  return new Date().toISOString()
}

function toTimestamp(value: string): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function localHasMeaningfulData(): boolean {
  try {
    const cards = JSON.parse(localStorage.getItem(CARD_STATE_STORAGE_KEY) || '{}')
    const exams = JSON.parse(localStorage.getItem(EXAM_SETTINGS_STORAGE_KEY) || '{}')
    return Object.keys(cards).length > 0 || Object.keys(exams).length > 0
  } catch {
    return false
  }
}

export function touchLocalUpdatedAt(): void {
  localStorage.setItem(LOCAL_UPDATED_AT_STORAGE_KEY, nowIso())
}

function getLocalUpdatedAt(): string {
  return localStorage.getItem(LOCAL_UPDATED_AT_STORAGE_KEY) || ''
}

function buildLocalSnapshot(): CloudSnapshot {
  return {
    version: 1,
    updatedAt: getLocalUpdatedAt() || nowIso(),
    cardState: localStorage.getItem(CARD_STATE_STORAGE_KEY) || '{}',
    examSettings: localStorage.getItem(EXAM_SETTINGS_STORAGE_KEY) || '{}',
  }
}

function applySnapshot(snapshot: CloudSnapshot): void {
  localStorage.setItem(CARD_STATE_STORAGE_KEY, snapshot.cardState || '{}')
  localStorage.setItem(EXAM_SETTINGS_STORAGE_KEY, snapshot.examSettings || '{}')
  localStorage.setItem(LOCAL_UPDATED_AT_STORAGE_KEY, snapshot.updatedAt || nowIso())
}

async function readRemoteSnapshot(): Promise<CloudSnapshot | null> {
  if (!syncAvailable) return null
  const client = getClient()
  const { data, error } = await client
    .from('user_state_snapshots')
    .select('state, updated_at')
    .eq('user_id', REMOTE_STATE_KEY)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const state = data.state as Partial<CloudSnapshot> | null
  if (!state || state.version !== 1) return null

  return {
    version: 1,
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : '',
    cardState: typeof state.cardState === 'string' ? state.cardState : '{}',
    examSettings: typeof state.examSettings === 'string' ? state.examSettings : '{}',
  }
}

async function writeRemoteSnapshot(snapshot: CloudSnapshot): Promise<void> {
  if (!syncAvailable) return
  const client = getClient()
  const { error } = await client.from('user_state_snapshots').upsert(
    {
      user_id: REMOTE_STATE_KEY,
      state: snapshot,
      updated_at: snapshot.updatedAt,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function syncFromRemoteOrSeedLocal(): Promise<void> {
  if (!syncAvailable) {
    setUnavailable()
    return
  }
  emitStatus({ state: 'syncing', message: 'Synchronisation Supabase en cours…' })

  const remote = await readRemoteSnapshot()
  const initialized = localStorage.getItem(SYNC_INITIALIZED_KEY) === '1'
  const localSnapshot = buildLocalSnapshot()

  if (!initialized) {
    if (remote) {
      const localTs = toTimestamp(localSnapshot.updatedAt)
      const remoteTs = toTimestamp(remote.updatedAt)
      if (remoteTs > localTs) {
        applySnapshot(remote)
        localStorage.setItem(SYNC_INITIALIZED_KEY, '1')
        window.location.reload()
        return
      }
      if (localHasMeaningfulData()) {
        await writeRemoteSnapshot(localSnapshot)
      } else {
        applySnapshot(remote)
      }
    } else {
      await writeRemoteSnapshot(localSnapshot)
    }
    localStorage.setItem(SYNC_INITIALIZED_KEY, '1')
  } else if (remote) {
    const localTs = toTimestamp(getLocalUpdatedAt())
    const remoteTs = toTimestamp(remote.updatedAt)
    if (remoteTs > localTs) {
      applySnapshot(remote)
      window.location.reload()
      return
    }
  }

  if (autoPullTimer) clearInterval(autoPullTimer)
  autoPullTimer = setInterval(() => {
    pullIfRemoteNewer().catch(() => {
      // silent background errors
    })
  }, 20000)

  emitStatus({
    state: 'ok',
    message: 'Synchronisé avec Supabase.',
  })
}

async function pullIfRemoteNewer(): Promise<void> {
  const remote = await readRemoteSnapshot()
  if (!remote) return

  const localTs = toTimestamp(getLocalUpdatedAt())
  const remoteTs = toTimestamp(remote.updatedAt)
  if (remoteTs > localTs) {
    applySnapshot(remote)
    window.location.reload()
  }
}

export async function initializeCloudSync(): Promise<void> {
  try {
    if (!syncAvailable) {
      setUnavailable()
      return
    }
    await syncFromRemoteOrSeedLocal()
  } catch (error) {
    setUnavailable(
      error instanceof Error && error.message
        ? `Synchronisation Supabase indisponible: ${error.message}`
        : 'Synchronisation Supabase indisponible.',
    )
  }
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener)
  listener({ ...syncStatus })
  return () => listeners.delete(listener)
}

export async function pushSyncNow(): Promise<void> {
  if (!syncAvailable) return
  const snapshot = buildLocalSnapshot()
  try {
    await writeRemoteSnapshot(snapshot)
    emitStatus({ state: 'ok', message: 'Synchronisé avec Supabase.' })
  } catch (error) {
    setUnavailable(
      error instanceof Error && error.message
        ? `Synchronisation Supabase indisponible: ${error.message}`
        : 'Synchronisation Supabase indisponible.',
    )
  }
}

export function scheduleAutoPush(): void {
  if (!syncAvailable) return
  if (autoPushTimer) clearTimeout(autoPushTimer)
  autoPushTimer = setTimeout(() => {
    pushSyncNow().finally(() => {
      autoPushTimer = null
    })
  }, 1200)
}
