import type {
  UserCardState,
  SM2State,
  CourseExamSettings,
  Rating,
  QueueState,
  ReviewLogEntry,
} from './types'
import { compareDate, todayLocal } from './utils/date'
import { pushSyncNow, scheduleAutoPush, touchLocalUpdatedAt } from './sync'

const CARD_STATE_STORAGE_KEY = 'flashcards_unil_v1'
const EXAM_SETTINGS_STORAGE_KEY = 'flashcards_unil_exam_v1'

const DEFAULT_SM2: SM2State = {
  interval: 0,
  easeFactor: 2.5,
  dueDate: '',
  reps: 0,
}

const DEFAULT_PERFORMANCE: UserCardState['performance'] = {
  againCount: 0,
  hardCount: 0,
  totalRated: 0,
  recentRatings: [],
}

const DEFAULT_EXAM_PROGRESS: UserCardState['examProgress'] = {
  examDateTracked: '',
  reviewsInExamCycle: 0,
  lastReviewedOn: '',
}

const DEFAULT_QUEUE_STATE: QueueState = 'new'

const DEFAULT_EXAM_SETTINGS: CourseExamSettings = {
  examDate: '',
  archived: false,
  updatedAt: '',
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeRatingArray(value: unknown): Rating[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => Number(v))
    .filter((v): v is Rating => v === 0 || v === 1 || v === 2 || v === 3)
    .slice(-8)
}

function normalizeSM2(raw: unknown): SM2State {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SM2 }
  const sm2 = raw as Partial<SM2State>
  return {
    interval: Math.max(0, Math.round(asNumber(sm2.interval, DEFAULT_SM2.interval))),
    easeFactor: Math.max(1.3, asNumber(sm2.easeFactor, DEFAULT_SM2.easeFactor)),
    dueDate: typeof sm2.dueDate === 'string' ? sm2.dueDate : '',
    reps: Math.max(0, Math.round(asNumber(sm2.reps, DEFAULT_SM2.reps))),
  }
}

function normalizeQueueState(value: unknown, sm2: SM2State): QueueState {
  if (value === 'new' || value === 'learning' || value === 'review' || value === 'relearning') {
    return value
  }
  if (sm2.reps >= 2) return 'review'
  if (sm2.reps > 0) return 'learning'
  return DEFAULT_QUEUE_STATE
}

function normalizeReviewLog(value: unknown): ReviewLogEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const e = entry as Partial<ReviewLogEntry>
      if (typeof e.date !== 'string') return null
      const rating = Number(e.rating)
      if (rating !== 0 && rating !== 1 && rating !== 2 && rating !== 3) return null
      return { date: e.date, rating: rating as Rating }
    })
    .filter((entry): entry is ReviewLogEntry => Boolean(entry))
    .slice(-80)
}

function normalizeUserCardState(raw: unknown): UserCardState {
  if (!raw || typeof raw !== 'object') {
    return {
      note: '',
      sm2: { ...DEFAULT_SM2 },
      queueState: DEFAULT_QUEUE_STATE,
      lastReviewedOn: '',
      reviewLog: [],
      performance: { ...DEFAULT_PERFORMANCE },
      examProgress: { ...DEFAULT_EXAM_PROGRESS },
    }
  }

  const state = raw as Partial<UserCardState>
  const performance = (state.performance ?? {}) as Partial<UserCardState['performance']>
  const examProgress = (state.examProgress ?? {}) as Partial<UserCardState['examProgress']>

  const normalizedSm2 = normalizeSM2(state.sm2)

  return {
    note: typeof state.note === 'string' ? state.note : '',
    sm2: normalizedSm2,
    queueState: normalizeQueueState(state.queueState, normalizedSm2),
    lastReviewedOn: typeof state.lastReviewedOn === 'string' ? state.lastReviewedOn : '',
    reviewLog: normalizeReviewLog(state.reviewLog),
    performance: {
      againCount: Math.max(0, Math.round(asNumber(performance.againCount, 0))),
      hardCount: Math.max(0, Math.round(asNumber(performance.hardCount, 0))),
      totalRated: Math.max(0, Math.round(asNumber(performance.totalRated, 0))),
      recentRatings: normalizeRatingArray(performance.recentRatings),
    },
    examProgress: {
      examDateTracked: typeof examProgress.examDateTracked === 'string' ? examProgress.examDateTracked : '',
      reviewsInExamCycle: Math.max(0, Math.round(asNumber(examProgress.reviewsInExamCycle, 0))),
      lastReviewedOn: typeof examProgress.lastReviewedOn === 'string' ? examProgress.lastReviewedOn : '',
    },
  }
}

function getAll(): Record<string, UserCardState> {
  try {
    const raw = localStorage.getItem(CARD_STATE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, UserCardState> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      normalized[key] = normalizeUserCardState(value)
    }
    return normalized
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, UserCardState>): void {
  localStorage.setItem(CARD_STATE_STORAGE_KEY, JSON.stringify(data))
  touchLocalUpdatedAt()
  scheduleAutoPush()
  pushSyncNow().catch(() => {
    // best effort immediate sync
  })
}

function normalizeCourseExamSettings(raw: unknown): CourseExamSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_EXAM_SETTINGS }
  const settings = raw as Partial<CourseExamSettings>
  return {
    examDate: typeof settings.examDate === 'string' ? settings.examDate : '',
    archived: Boolean(settings.archived),
    updatedAt: typeof settings.updatedAt === 'string' ? settings.updatedAt : '',
  }
}

function getAllExamSettingsRaw(): Record<string, CourseExamSettings> {
  try {
    const raw = localStorage.getItem(EXAM_SETTINGS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: Record<string, CourseExamSettings> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      normalized[key] = normalizeCourseExamSettings(value)
    }
    return normalized
  } catch {
    return {}
  }
}

function saveAllExamSettings(data: Record<string, CourseExamSettings>): void {
  localStorage.setItem(EXAM_SETTINGS_STORAGE_KEY, JSON.stringify(data))
  touchLocalUpdatedAt()
  scheduleAutoPush()
  pushSyncNow().catch(() => {
    // best effort immediate sync
  })
}

export function getCardState(cardKey: string): UserCardState {
  const all = getAll()
  return all[cardKey] ?? normalizeUserCardState(null)
}

export function saveNote(cardKey: string, note: string): void {
  const all = getAll()
  const existing = all[cardKey] ?? normalizeUserCardState(null)
  all[cardKey] = { ...existing, note }
  saveAll(all)
}

export function saveSM2(cardKey: string, sm2: SM2State): void {
  const all = getAll()
  const existing = all[cardKey] ?? normalizeUserCardState(null)
  all[cardKey] = { ...existing, sm2 }
  saveAll(all)
}

export function saveCardState(cardKey: string, state: UserCardState): void {
  const all = getAll()
  all[cardKey] = normalizeUserCardState(state)
  saveAll(all)
}

export function getAllStates(): Record<string, UserCardState> {
  return getAll()
}

function isPastExamDate(examDate: string): boolean {
  return Boolean(examDate) && compareDate(examDate, todayLocal()) < 0
}

function withEffectiveArchive(settings: CourseExamSettings): CourseExamSettings {
  if (settings.archived || isPastExamDate(settings.examDate)) {
    return { ...settings, archived: true }
  }
  return settings
}

export function getCourseExamSettings(courseId: string): CourseExamSettings {
  const all = getAllExamSettingsRaw()
  const settings = all[courseId] ?? { ...DEFAULT_EXAM_SETTINGS }
  return withEffectiveArchive(settings)
}

export function getAllCourseExamSettings(): Record<string, CourseExamSettings> {
  const all = getAllExamSettingsRaw()
  const result: Record<string, CourseExamSettings> = {}
  for (const [courseId, settings] of Object.entries(all)) {
    result[courseId] = withEffectiveArchive(settings)
  }
  return result
}

export function saveCourseExamDate(courseId: string, examDate: string): void {
  const all = getAllExamSettingsRaw()
  const next: CourseExamSettings = {
    examDate,
    archived: isPastExamDate(examDate),
    updatedAt: todayLocal(),
  }
  all[courseId] = next
  saveAllExamSettings(all)
}

export function clearCourseExamDate(courseId: string): void {
  const all = getAllExamSettingsRaw()
  all[courseId] = { ...DEFAULT_EXAM_SETTINGS, updatedAt: todayLocal() }
  saveAllExamSettings(all)
}

export function setCourseArchived(courseId: string, archived: boolean): void {
  const all = getAllExamSettingsRaw()
  const existing = all[courseId] ?? { ...DEFAULT_EXAM_SETTINGS }
  all[courseId] = { ...existing, archived, updatedAt: todayLocal() }
  saveAllExamSettings(all)
}
