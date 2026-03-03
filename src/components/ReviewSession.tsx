import { useEffect, useState, useCallback } from 'react'
import type { Card, Deck, Rating } from '../types'
import { getCardState, saveSM2 } from '../store'
import { isDue, applyRating, getCardKey } from '../scheduler'
import CardMCQSingle from './CardMCQSingle'
import CardMCQMulti from './CardMCQMulti'
import CardImageRecall from './CardImageRecall'
import CardDropdown from './CardDropdown'
import NoteEditor from './NoteEditor'

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

  useEffect(() => {
    fetch(`/data/${courseId}/${deckId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json() as Promise<Deck>
      })
      .then((data) => {
        setDeck(data)
        // Build session queue: due cards first, then new cards, then future cards
        const cards = [...data.cards]
        cards.sort((a, b) => {
          const stA = getCardState(getCardKey(courseId, deckId, a.id))
          const stB = getCardState(getCardKey(courseId, deckId, b.id))
          const dueA = isDue(stA.sm2) ? 0 : 1
          const dueB = isDue(stB.sm2) ? 0 : 1
          return dueA - dueB
        })
        setQueue(cards.map((c) => ({ card: c, isLap: false })))
        setLoading(false)
      })
      .catch(() => {
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
      const newSM2 = applyRating(state.sm2, rating)
      saveSM2(cardKey, newSM2)

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
    [currentCard, currentIdx, queue.length, courseId, deckId],
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

  if (!currentCard) return null

  const progress = queue.length > 0 ? Math.round((currentIdx / queue.length) * 100) : 0

  return (
    <div className="page">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>← Retour</button>
        <div className="session-progress-wrap">
          <span className="session-counter">{currentIdx + 1} / {queue.length}</span>
          <div className="progress-bar-wrap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
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

          {/* image_back in answer phase */}
          {phase === 'answer' && currentCard.image_back && (
            <div className="image-back-wrap">
              <img src={currentCard.image_back} alt="Illustration" className="card-image" />
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
