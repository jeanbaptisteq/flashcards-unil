import { useEffect, useState, useCallback } from 'react'
import type { Card, CoursePdfRef, Deck, Rating } from '../types'
import { getCardState, getCourseExamSettings, saveCardState } from '../store'
import {
  appendReviewLog,
  applyRatingWithExamContext,
  computeReviewPriorityScore,
  deriveQueueState,
  getCardKey,
  hasAnyReviewOnDate,
  isImportantCard,
  isScheduledDue,
  updateExamProgress,
  updatePerformance,
  wasDifficultOnDate,
} from '../scheduler'
import { assetUrl, dataUrl } from '../utils/paths'
import { todayLocal } from '../utils/date'
import CardMCQSingle from './CardMCQSingle'
import CardMCQMulti from './CardMCQMulti'
import CardImageRecall from './CardImageRecall'
import CardDropdown from './CardDropdown'
import CardNumericInput from './CardNumericInput'
import NoteEditor from './NoteEditor'
import CoursePdfPanel from './CoursePdfPanel'
import { buildCourseSources, mergeCourseSources } from '../utils/courseSources'

type Phase = 'question' | 'answer'

interface SessionCard {
  card: Card
  isLap: boolean
}

interface Props {
  courseId: string
  deckId: string
  onBack: () => void
}

const DAILY_NEW_LIMIT = 20

const RATING_LABELS: Record<Rating, string> = {
  0: 'Encore',
  1: 'Difficile',
  2: 'Bien',
  3: 'Facile',
}

const RATING_CLASSES: Record<Rating, string> = {
  0: 'rating-again',
  1: 'rating-hard',
  2: 'rating-good',
  3: 'rating-easy',
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

function normalizeNumberLike(value: string): string {
  return value.trim().replace(/\s+/g, '').replace(',', '.')
}

export default function ReviewSession({ courseId, deckId, onBack }: Props) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [queue, setQueue] = useState<SessionCard[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [selectedAnswer, setSelectedAnswer] = useState<string[]>([])
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [completed, setCompleted] = useState(false)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [examDate, setExamDate] = useState('')
  const [isArchived, setIsArchived] = useState(false)
  const [sourcePdfs, setSourcePdfs] = useState<CoursePdfRef[]>([])

  useEffect(() => {
    const exam = getCourseExamSettings(courseId)
    setExamDate(exam.examDate)
    setIsArchived(exam.archived)

    fetch(dataUrl(`/data/${courseId}/index.json`))
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json() as Promise<{ sourcePdf?: string | null; sourcePdfs?: CoursePdfRef[] }>
      })
      .then(async (index) => {
        const courseSources = buildCourseSources(index)
        const deckResponse = await fetch(dataUrl(`/data/${courseId}/${deckId}.json`))
        if (!deckResponse.ok) throw new Error('not found')
        const data = (await deckResponse.json()) as Deck

        setSourcePdfs(mergeCourseSources(buildCourseSources(data), courseSources))
        setDeck(data)
        const today = todayLocal()
        const cards = [...data.cards]

        const hasSessionToday = cards.some((card) => {
          const state = getCardState(getCardKey(courseId, deckId, card.id))
          return hasAnyReviewOnDate(state, today)
        })

        const relearningDue: Card[] = []
        const reviewDue: Array<{ card: Card; score: number }> = []
        const difficultToday: Card[] = []
        const newCards: Card[] = []

        for (const card of cards) {
          const state = getCardState(getCardKey(courseId, deckId, card.id))

          if (wasDifficultOnDate(state, today)) {
            difficultToday.push(card)
            continue
          }

          if (isScheduledDue(state, today)) {
            if (state.queueState === 'learning' || state.queueState === 'relearning') {
              relearningDue.push(card)
            } else {
              reviewDue.push({ card, score: computeReviewPriorityScore(state, today) })
            }
            continue
          }

          if (state.queueState === 'new' && !hasSessionToday) {
            newCards.push(card)
          }
        }

        reviewDue.sort((a, b) => b.score - a.score)

        const finalQueue = [
          ...difficultToday,
          ...relearningDue,
          ...reviewDue.map((entry) => entry.card),
          ...newCards.slice(0, DAILY_NEW_LIMIT),
        ]

        // Fallback for quiz decks: always allow a run even if scheduler has no due cards
        // (common when a synced state marks the deck as already studied today).
        const queueToUse = finalQueue.length === 0 && data.id.includes('quiz')
          ? cards
          : finalQueue

        setQueue(queueToUse.map((c) => ({ card: c, isLap: false })))
        setLoading(false)
      })
      .catch(() => {
        setSourcePdfs([])
        setError(true)
        setLoading(false)
      })
  }, [courseId, deckId])

  const currentItem = queue[currentIdx]
  const currentCard = currentItem?.card

  const handleVerify = useCallback(() => {
    if (!currentCard) return
    let correct: boolean

    if (currentCard.type === 'mcq_single') {
      correct = arraysEqual([...selectedAnswer].sort(), [...currentCard.correct].sort())
    } else if (currentCard.type === 'mcq_multi') {
      correct = arraysEqual([...selectedAnswer].sort(), [...currentCard.correct].sort())
    } else if (currentCard.type === 'dropdown') {
      correct = selectedAnswer[0] === currentCard.correct
    } else if (currentCard.type === 'numeric_input') {
      const userValue = normalizeNumberLike(selectedAnswer[0] ?? '')
      const accepted = [currentCard.correct, ...(currentCard.accepted ?? [])].map(normalizeNumberLike)
      correct = accepted.includes(userValue)
    } else {
      correct = true // image_recall: not auto-graded
    }

    setIsCorrect(correct)
    setPhase('answer')
    setStats((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }))
  }, [currentCard, selectedAnswer])

  const handleRating = useCallback(
    (rating: Rating) => {
      if (!currentCard) return
      const cardKey = getCardKey(courseId, deckId, currentCard.id)
      const state = getCardState(cardKey)
      const reviewDate = todayLocal()
      const performance = updatePerformance(state.performance, rating)
      const reviewLog = appendReviewLog(state.reviewLog, reviewDate, rating)

      const activeExamDate = !isArchived ? examDate : ''
      const examProgress = activeExamDate
        ? updateExamProgress(state.examProgress, activeExamDate, reviewDate)
        : { examDateTracked: '', reviewsInExamCycle: 0, lastReviewedOn: '' }

      const newSM2 = applyRatingWithExamContext(state.sm2, rating, activeExamDate
        ? {
            examDate: activeExamDate,
            isImportant: isImportantCard(performance, state.sm2.easeFactor),
            reviewsInExamCycle: examProgress.reviewsInExamCycle,
          }
        : null)
      const queueState = deriveQueueState(state.queueState, rating, newSM2)

      saveCardState(cardKey, {
        ...state,
        queueState,
        lastReviewedOn: reviewDate,
        reviewLog,
        performance,
        examProgress,
        sm2: newSM2,
      })

      if (rating === 0) {
        // Add card back to end of queue
        setQueue((q) => [...q, { card: currentCard, isLap: true }])
      }

      const nextIdx = currentIdx + 1
      if (nextIdx >= queue.length + (rating === 0 ? 1 : 0)) {
        setCompleted(true)
      } else {
        setCurrentIdx(nextIdx)
        setPhase('question')
        setSelectedAnswer([])
        setIsCorrect(null)
      }
    },
    [currentCard, currentIdx, queue.length, courseId, deckId, examDate, isArchived],
  )

  const cardKey = currentCard ? getCardKey(courseId, deckId, currentCard.id) : ''
  // For image_recall in question phase: show reveal button
  const isImageRecall = currentCard?.type === 'image_recall'
  const canVerify = selectedAnswer.length > 0 || isImageRecall

  if (loading) {
    return (
      <div className="page">
        <header className="view-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
        </header>
        <p className="empty-state">Chargement…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <header className="view-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
        </header>
        <p className="empty-state error">Impossible de charger ce deck.</p>
      </div>
    )
  }

  if (isArchived) {
    return (
      <div className="page">
        <header className="view-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
        </header>
        <p className="empty-state">Ce cours est archivé car la date d’examen est passée.</p>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="page">
        <header className="view-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
          <h1 className="view-title">{deck?.lesson}</h1>
        </header>
        <div className="completion-screen">
          <div className="completion-icon">✓</div>
          <h2 className="completion-title">Session terminée</h2>
          <p className="completion-stats">
            {stats.correct} / {stats.total} bonnes réponses
          </p>
          <div className="completion-bar-wrap">
            <div
              className="completion-bar"
              style={{ width: `${stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0}%` }}
            />
          </div>
          <button className="btn-primary" onClick={onBack} style={{ marginTop: '2rem' }}>
            Retour au cours
          </button>
        </div>
      </div>
    )
  }

  if (!currentCard) {
    return (
      <div className="page">
        <header className="view-header">
          <button className="btn-back" onClick={onBack}>← Retour</button>
        </header>
        <p className="empty-state">Rien à réviser pour ce deck aujourd’hui.</p>
      </div>
    )
  }

  const progress = queue.length > 0 ? Math.round((currentIdx / queue.length) * 100) : 0

  return (
    <div className="page">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div className="session-header-right">
          <div className="session-progress-wrap">
            <span className="session-counter">{currentIdx + 1} / {queue.length}</span>
            {examDate && <span className="exam-mode-badge">Mode examen actif</span>}
            <div className="progress-bar-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
          {sourcePdfs.length > 0 && (
            <div className="session-pdf-access">
              <CoursePdfPanel
                title="Source du cours"
                pdfs={sourcePdfs}
                sourceHint={deck?.lesson ?? deckId}
                defaultExpanded={false}
                compact={true}
              />
            </div>
          )}
        </div>
      </header>

      <main className="review-main">
        <div className="card-container">
          <div className="card-phase-label">
            {phase === 'question' ? 'Question' : 'Réponse'}
          </div>

          {currentCard.type === 'mcq_single' && (
            <CardMCQSingle
              card={currentCard}
              phase={phase}
              selected={selectedAnswer}
              isCorrect={isCorrect}
              onSelect={(ids) => setSelectedAnswer(ids)}
            />
          )}
          {currentCard.type === 'mcq_multi' && (
            <CardMCQMulti
              card={currentCard}
              phase={phase}
              selected={selectedAnswer}
              isCorrect={isCorrect}
              onSelect={(ids) => setSelectedAnswer(ids)}
            />
          )}
          {currentCard.type === 'image_recall' && (
            <CardImageRecall
              card={currentCard}
              phase={phase}
            />
          )}
          {currentCard.type === 'dropdown' && (
            <CardDropdown
              card={currentCard}
              phase={phase}
              selected={selectedAnswer[0] ?? ''}
              isCorrect={isCorrect}
              onSelect={(val) => setSelectedAnswer([val])}
            />
          )}
          {currentCard.type === 'numeric_input' && (
            <CardNumericInput
              card={currentCard}
              phase={phase}
              selected={selectedAnswer[0] ?? ''}
              isCorrect={isCorrect}
              onSelect={(val) => setSelectedAnswer([val])}
            />
          )}

          {/* image_back in answer phase */}
          {phase === 'answer' && currentCard.image_back && (
            <div className="image-back-wrap">
              <img src={assetUrl(currentCard.image_back)} alt="Illustration" className="card-image" />
            </div>
          )}
        </div>

        {/* Note editor - only in answer phase */}
        {phase === 'answer' && (
          <NoteEditor cardKey={cardKey} />
        )}

        {/* Action buttons */}
        <div className="action-row">
          {phase === 'question' && (
            <>
              {isImageRecall ? (
                <button
                  className="btn-primary"
                  onClick={handleVerify}
                >
                  Voir la réponse
                </button>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleVerify}
                  disabled={!canVerify}
                >
                  Vérifier
                </button>
              )}
            </>
          )}

          {phase === 'answer' && (
            <div className="rating-buttons">
              {([0, 1, 2, 3] as Rating[]).map((r) => (
                <button
                  key={r}
                  className={`btn-rating ${RATING_CLASSES[r]}`}
                  onClick={() => handleRating(r)}
                >
                  {RATING_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
