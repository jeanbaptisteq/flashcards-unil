import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

const CARD_STATE_STORAGE_KEY = 'flashcards_unil_v1'
const EXAM_SETTINGS_STORAGE_KEY = 'flashcards_unil_exam_v1'
const LOCAL_UPDATED_AT_STORAGE_KEY = 'flashcards_unil_local_updated_at_v1'
const SYNC_INITIALIZED_KEY = 'flashcards_unil_sync_initialized_v1'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wqveiutqcwdjhpygzlbw.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdmVpdXRxY3dkamhweWd6bGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjk3OTEsImV4cCI6MjA4OTk0NTc5MX0.R0qU7mYFdj9__13x7jGFp7HV1EWOwmy8zJuv6XMCMP4'

interface CloudSnapshot {
  version: 1
  updatedAt: string
  cardState: string
  examSettings: string
}

type SyncState =
  | 'idle'
  | 'auth_required'
  | 'sending_magic_link'
  | 'syncing'
  | 'ok'
  | 'error'

export interface CloudSyncStatus {
  state: SyncState
  email: string
  message: string
}

const syncStatus: CloudSyncStatus = {
  state: 'idle',
  email: '',
  message: '',
}

type Listener = (status: CloudSyncStatus) => void

const listeners = new Set<Listener>()

let supabase: SupabaseClient | null = null
let currentSession: Session | null = null
let autoPushTimer: ReturnType<typeof setTimeout> | null = null
let autoPullTimer: ReturnType<typeof setInterval> | null = null

function emitStatus(next: Partial<CloudSyncStatus>): void {
  Object.assign(syncStatus, next)
  for (const listener of listeners) listener({ ...syncStatus })
}

function getClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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

async function readRemoteSnapshot(userId: string): Promise<CloudSnapshot | null> {
  const client = getClient()
  const { data, error } = await client
    .from('user_state_snapshots')
    .select('state, updated_at')
    .eq('user_id', userId)
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

async function writeRemoteSnapshot(userId: string, snapshot: CloudSnapshot): Promise<void> {
  const client = getClient()
  const { error } = await client.from('user_state_snapshots').upsert(
    {
      user_id: userId,
      state: snapshot,
      updated_at: snapshot.updatedAt,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

async function syncOnAuthenticated(session: Session): Promise<void> {
  currentSession = session
  emitStatus({
    state: 'syncing',
    email: session.user.email || '',
    message: 'Synchronisation en cours…',
  })

  const userId = session.user.id
  const remote = await readRemoteSnapshot(userId)
  const initialized = localStorage.getItem(SYNC_INITIALIZED_KEY) === '1'
  const localSnapshot = buildLocalSnapshot()

  if (!initialized) {
    if (localHasMeaningfulData()) {
      await writeRemoteSnapshot(userId, localSnapshot)
    } else if (remote) {
      applySnapshot(remote)
      window.location.reload()
      return
    } else {
      await writeRemoteSnapshot(userId, localSnapshot)
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
    email: session.user.email || '',
    message: 'Synchronisé.',
  })
}

async function pullIfRemoteNewer(): Promise<void> {
  if (!currentSession) return
  const remote = await readRemoteSnapshot(currentSession.user.id)
  if (!remote) return
  const localTs = toTimestamp(getLocalUpdatedAt())
  const remoteTs = toTimestamp(remote.updatedAt)
  if (remoteTs > localTs) {
    applySnapshot(remote)
    window.location.reload()
  }
}

export async function initializeCloudSync(): Promise<void> {
  const client = getClient()
  const { data } = await client.auth.getSession()
  currentSession = data.session

  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session
    if (!session) {
      emitStatus({
        state: 'auth_required',
        email: '',
        message: 'Connectez-vous pour activer la sync multi-appareils.',
      })
      return
    }
    syncOnAuthenticated(session).catch((error: unknown) => {
      emitStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Erreur de synchronisation.',
      })
    })
  })

  if (!data.session) {
    emitStatus({
      state: 'auth_required',
      email: '',
      message: 'Connectez-vous pour activer la sync multi-appareils.',
    })
    return
  }

  await syncOnAuthenticated(data.session)
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener)
  listener({ ...syncStatus })
  return () => listeners.delete(listener)
}

export async function requestMagicLink(email: string): Promise<void> {
  const client = getClient()
  emitStatus({ state: 'sending_magic_link', message: 'Envoi du lien magique…' })
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href,
    },
  })
  if (error) {
    emitStatus({ state: 'error', message: error.message })
    throw error
  }
  emitStatus({ state: 'auth_required', message: 'Email envoyé. Ouvrez le lien de connexion.' })
}

export async function signOutCloudSync(): Promise<void> {
  const client = getClient()
  await client.auth.signOut()
  currentSession = null
  if (autoPullTimer) {
    clearInterval(autoPullTimer)
    autoPullTimer = null
  }
  emitStatus({
    state: 'auth_required',
    email: '',
    message: 'Déconnecté.',
  })
}

export async function pushSyncNow(): Promise<void> {
  if (!currentSession) return
  const snapshot = buildLocalSnapshot()
  await writeRemoteSnapshot(currentSession.user.id, snapshot)
  emitStatus({ state: 'ok', message: 'Synchronisé.' })
}

export function scheduleAutoPush(): void {
  if (!currentSession) return
  if (autoPushTimer) clearTimeout(autoPushTimer)
  autoPushTimer = setTimeout(() => {
    pushSyncNow()
      .catch((error: unknown) => {
        emitStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Erreur d’envoi cloud.',
        })
      })
    autoPushTimer = null
  }, 1200)
}
