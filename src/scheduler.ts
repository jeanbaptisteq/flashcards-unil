import type { SM2State, Rating } from './types'

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function isDue(sm2: SM2State): boolean {
  if (!sm2.dueDate || sm2.reps === 0) return true
  return sm2.dueDate <= todayStr()
}

export function applyRating(sm2: SM2State, rating: Rating): SM2State {
  let { interval, easeFactor, reps } = sm2

  if (rating === 0) {
    // Encore: full reset, re-add to current session
    return { interval: 1, easeFactor: Math.max(1.3, easeFactor - 0.32), dueDate: addDays(1), reps: 0 }
  }

  // Adjust ease factor based on rating
  easeFactor = easeFactor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02)
  easeFactor = Math.max(1.3, easeFactor)

  if (rating === 1) {
    // Difficile: keep reps but reduce interval
    interval = Math.max(1, Math.round(interval * 1.2))
  } else {
    // Bien (2) or Facile (3)
    if (reps === 0) {
      interval = 1
    } else if (reps === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    if (rating === 3) {
      // Facile: extra boost
      interval = Math.round(interval * 1.3)
    }
    reps += 1
  }

  return { interval, easeFactor, dueDate: addDays(interval), reps }
}

export function getCardKey(courseId: string, deckId: string, cardId: string): string {
  return `${courseId}__${deckId}__${cardId}`
}
