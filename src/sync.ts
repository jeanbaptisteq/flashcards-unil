const CARD_STATE_STORAGE_KEY = 'flashcards_unil_v1'
const EXAM_SETTINGS_STORAGE_KEY = 'flashcards_unil_exam_v1'
const SYNC_SETTINGS_STORAGE_KEY = 'flashcards_unil_sync_settings_v1'
const LOCAL_UPDATED_AT_STORAGE_KEY = 'flashcards_unil_local_updated_at_v1'
const SYNC_FILE_NAME = 'flashcards-unil-sync.json'
const AUTO_PULL_COOLDOWN_MS = 30 * 1000

export interface SyncSettings {
  gistId: string
  token: string
  autoSync: boolean
}

interface SyncPayload {
  version: 1
  updatedAt: string
  cardState: string
  examSettings: string
}

let autoPushTimer: ReturnType<typeof setTimeout> | null = null
let lastAutoPullAt = 0

function nowIso(): string {
  return new Date().toISOString()
}

function toNumber(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function defaultSyncSettings(): SyncSettings {
  return {
    gistId: '',
    token: '',
    autoSync: false,
  }
}

export function getSyncSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(SYNC_SETTINGS_STORAGE_KEY)
    if (!raw) return defaultSyncSettings()
    const parsed = JSON.parse(raw) as Partial<SyncSettings>
    return {
      gistId: typeof parsed.gistId === 'string' ? parsed.gistId.trim() : '',
      token: typeof parsed.token === 'string' ? parsed.token.trim() : '',
      autoSync: Boolean(parsed.autoSync),
    }
  } catch {
    return defaultSyncSettings()
  }
}

export function saveSyncSettings(settings: SyncSettings): void {
  localStorage.setItem(
    SYNC_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      gistId: settings.gistId.trim(),
      token: settings.token.trim(),
      autoSync: settings.autoSync,
    }),
  )
}

export function touchLocalUpdatedAt(): void {
  localStorage.setItem(LOCAL_UPDATED_AT_STORAGE_KEY, nowIso())
}

export function getLocalUpdatedAt(): string {
  return localStorage.getItem(LOCAL_UPDATED_AT_STORAGE_KEY) ?? ''
}

function buildPayload(): SyncPayload {
  return {
    version: 1,
    updatedAt: getLocalUpdatedAt() || nowIso(),
    cardState: localStorage.getItem(CARD_STATE_STORAGE_KEY) ?? '{}',
    examSettings: localStorage.getItem(EXAM_SETTINGS_STORAGE_KEY) ?? '{}',
  }
}

function applyRemotePayload(payload: SyncPayload): void {
  localStorage.setItem(CARD_STATE_STORAGE_KEY, payload.cardState || '{}')
  localStorage.setItem(EXAM_SETTINGS_STORAGE_KEY, payload.examSettings || '{}')
  localStorage.setItem(LOCAL_UPDATED_AT_STORAGE_KEY, payload.updatedAt || nowIso())
}

function assertConfigured(settings: SyncSettings): void {
  if (!settings.gistId || !settings.token) {
    throw new Error('Configuration de synchronisation incomplète.')
  }
}

async function fetchGist(settings: SyncSettings): Promise<any> {
  const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: impossible de lire le Gist.`)
  }
  return response.json()
}

function extractPayloadFromGist(gist: any): SyncPayload | null {
  const files = gist?.files ?? {}
  const preferred = files[SYNC_FILE_NAME]
  const file = preferred ?? Object.values(files)[0]
  const content = typeof (file as any)?.content === 'string' ? (file as any).content : ''
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as Partial<SyncPayload>
    if (parsed.version !== 1) return null
    return {
      version: 1,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
      cardState: typeof parsed.cardState === 'string' ? parsed.cardState : '{}',
      examSettings: typeof parsed.examSettings === 'string' ? parsed.examSettings : '{}',
    }
  } catch {
    return null
  }
}

async function patchGist(settings: SyncSettings, payload: SyncPayload): Promise<void> {
  const response = await fetch(`https://api.github.com/gists/${settings.gistId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      files: {
        [SYNC_FILE_NAME]: {
          content: JSON.stringify(payload),
        },
      },
    }),
  })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: impossible d'écrire le Gist.`)
  }
}

export async function pushSyncNow(): Promise<void> {
  const settings = getSyncSettings()
  assertConfigured(settings)
  const payload = buildPayload()
  await patchGist(settings, payload)
}

export async function pullSyncNow(): Promise<'applied' | 'ignored'> {
  const settings = getSyncSettings()
  assertConfigured(settings)
  const gist = await fetchGist(settings)
  const remote = extractPayloadFromGist(gist)
  if (!remote) {
    return 'ignored'
  }
  const remoteTs = toNumber(remote.updatedAt)
  const localTs = toNumber(getLocalUpdatedAt())
  if (remoteTs <= localTs) {
    return 'ignored'
  }
  applyRemotePayload(remote)
  return 'applied'
}

export function scheduleAutoPush(): void {
  const settings = getSyncSettings()
  if (!settings.autoSync || !settings.gistId || !settings.token) return

  if (autoPushTimer) clearTimeout(autoPushTimer)
  autoPushTimer = setTimeout(() => {
    pushSyncNow().catch(() => {
      // Keep silent for auto-sync background failures.
    })
    autoPushTimer = null
  }, 1500)
}

export async function tryAutoPull(): Promise<'applied' | 'ignored'> {
  const settings = getSyncSettings()
  if (!settings.autoSync || !settings.gistId || !settings.token) return 'ignored'
  const now = Date.now()
  if (now - lastAutoPullAt < AUTO_PULL_COOLDOWN_MS) return 'ignored'
  lastAutoPullAt = now
  try {
    return await pullSyncNow()
  } catch {
    return 'ignored'
  }
}

