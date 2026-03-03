import type { UserCardState, SM2State } from './types'

const STORAGE_KEY = 'flashcards_unil_v1'

const DEFAULT_SM2: SM2State = {
  interval: 0,
  easeFactor: 2.5,
  dueDate: '',
  reps: 0,
}

function getAll(): Record<string, UserCardState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, UserCardState>) : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, UserCardState>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function getCardState(cardKey: string): UserCardState {
  const all = getAll()
  return all[cardKey] ?? { note: '', sm2: { ...DEFAULT_SM2 } }
}

export function saveNote(cardKey: string, note: string): void {
  const all = getAll()
  const existing = all[cardKey] ?? { note: '', sm2: { ...DEFAULT_SM2 } }
  all[cardKey] = { ...existing, note }
  saveAll(all)
}

export function saveSM2(cardKey: string, sm2: SM2State): void {
  const all = getAll()
  const existing = all[cardKey] ?? { note: '', sm2: { ...DEFAULT_SM2 } }
  all[cardKey] = { ...existing, sm2 }
  saveAll(all)
}

export function getAllStates(): Record<string, UserCardState> {
  return getAll()
}
