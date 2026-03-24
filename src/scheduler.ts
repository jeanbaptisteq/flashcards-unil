import type { SM2State, Rating, UserCardState } from './types'
import { addDaysToToday, compareDate, daysBetween, todayLocal } from './utils/date'

export function isDue(sm2: SM2State): boolean {
  if (!sm2.dueDate) return true
  return compareDate(sm2.dueDate, todayLocal()) <= 0
}

export function isScheduledDue(state: UserCardState, onDate = todayLocal()): boolean {
  if (state.queueState === 'new') return false
  if (!state.sm2.dueDate) return true
  return compareDate(state.sm2.dueDate, onDate) <= 0
}

export function getLastRatingOnDate(state: UserCardState, date: string): Rating | null {
  for (let i = state.reviewLog.length - 1; i >= 0; i -= 1) {
    const entry = state.reviewLog[i]
    if (entry.date === date) return entry.rating
    if (entry.date < date) break
  }
  return null
}

export function wasDifficultOnDate(state: UserCardState, date: string): boolean {
  const last = getLastRatingOnDate(state, date)
  return last === 0 || last === 1
}

export function hasAnyReviewOnDate(state: UserCardState, date: string): boolean {
  return state.reviewLog.some((entry) => entry.date === date)
}

export function isMastered(state: UserCardState): boolean {
  return state.queueState === 'review' && state.sm2.reps >= 3 && state.sm2.easeFactor >= 2
}

export function applyRating(sm2: SM2State, rating: Rating): SM2State {
  let { interval, easeFactor, reps } = sm2

  if (rating === 0) {
    // Encore: full reset, re-add to current session
    return { interval: 1, easeFactor: Math.max(1.3, easeFactor - 0.32), dueDate: addDaysToToday(1), reps: 0 }
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

  return { interval, easeFactor, dueDate: addDaysToToday(interval), reps }
}

export function updatePerformance(
  performance: UserCardState['performance'],
  rating: Rating,
): UserCardState['performance'] {
  return {
    againCount: performance.againCount + (rating === 0 ? 1 : 0),
    hardCount: performance.hardCount + (rating === 1 ? 1 : 0),
    totalRated: performance.totalRated + 1,
    recentRatings: [...performance.recentRatings, rating].slice(-8),
  }
}

export function appendReviewLog(
  reviewLog: UserCardState['reviewLog'],
  date: string,
  rating: Rating,
): UserCardState['reviewLog'] {
  return [...reviewLog, { date, rating }].slice(-80)
}

export function isImportantCard(
  performance: UserCardState['performance'],
  easeFactor: number,
): boolean {
  if (performance.totalRated < 3) return false
  const errorRate = (performance.againCount + performance.hardCount) / Math.max(1, performance.totalRated)
  const recentWeak = performance.recentRatings.filter((r) => r <= 1).length >= 2
  return errorRate >= 0.35 || recentWeak || easeFactor <= 1.7
}

export function updateExamProgress(
  progress: UserCardState['examProgress'],
  examDate: string,
  reviewDate: string,
): UserCardState['examProgress'] {
  if (!examDate) return { examDateTracked: '', reviewsInExamCycle: 0, lastReviewedOn: '' }
  if (progress.examDateTracked !== examDate) {
    return { examDateTracked: examDate, reviewsInExamCycle: 1, lastReviewedOn: reviewDate }
  }
  if (progress.lastReviewedOn === reviewDate) {
    return progress
  }
  return {
    examDateTracked: examDate,
    reviewsInExamCycle: progress.reviewsInExamCycle + 1,
    lastReviewedOn: reviewDate,
  }
}

interface ExamContext {
  examDate: string
  isImportant: boolean
  reviewsInExamCycle: number
}

export function applyRatingWithExamContext(
  sm2: SM2State,
  rating: Rating,
  exam: ExamContext | null,
): SM2State {
  const next = applyRating(sm2, rating)
  if (!exam?.examDate) return next

  const today = todayLocal()
  const daysLeft = daysBetween(today, exam.examDate)
  if (daysLeft <= 0) return next

  const requiredReviews = exam.isImportant ? 2 : 1
  const remainingNeeded = Math.max(0, requiredReviews - exam.reviewsInExamCycle)
  if (remainingNeeded <= 0) return next

  // Keep enough room for the remaining reviews before exam day.
  const maxInterval = Math.max(1, Math.floor(daysLeft / (remainingNeeded + 1)))
  const cappedInterval = Math.min(next.interval, maxInterval)
  const cappedDueDate = addDaysToToday(cappedInterval)
  const safeDueDate = compareDate(cappedDueDate, exam.examDate) > 0 ? exam.examDate : cappedDueDate

  return {
    ...next,
    interval: cappedInterval,
    dueDate: safeDueDate,
  }
}

export function deriveQueueState(
  previousState: UserCardState['queueState'],
  rating: Rating,
  nextSM2: SM2State,
): UserCardState['queueState'] {
  if (rating === 0) return 'relearning'
  if (rating === 1) return previousState === 'new' ? 'learning' : previousState
  if (nextSM2.reps >= 2) return 'review'
  return 'learning'
}

export function computeReviewPriorityScore(state: UserCardState, today = todayLocal()): number {
  const interval = Math.max(1, state.sm2.interval)
  if (!state.sm2.dueDate) return 0
  const overdueDays = Math.max(0, daysBetween(state.sm2.dueDate, today))
  return overdueDays / interval
}

export function getCardKey(courseId: string, deckId: string, cardId: string): string {
  return `${courseId}__${deckId}__${cardId}`
}
