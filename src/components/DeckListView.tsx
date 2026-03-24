import { useEffect, useState } from 'react'
import type { CourseIndex, DeckMeta } from '../types'
import {
  clearCourseExamDate,
  getAllStates,
  getCourseExamSettings,
  saveCourseExamDate,
} from '../store'
import { getCardKey, isMastered, isScheduledDue, wasDifficultOnDate } from '../scheduler'
import { dataUrl } from '../utils/paths'
import { daysBetween, todayLocal } from '../utils/date'

interface DeckStats {
  total: number
  due: number
}

interface CourseAnalytics {
  totalCards: number
  masteredCards: number
  dueTodayCards: number
  studiedTodayCards: number
  difficultCards: number
}

interface Props {
  courseId: string
  onBack: () => void
  onNavigateDeck: (deckId: string) => void
}

const COURSE_NAMES: Record<string, string> = {
  'controle-gestion': 'Contrôle de gestion',
  'gestion-operations': 'Gestion des opérations',
  'leadership': 'Leadership',
  'bia': 'Business Intelligence & Analytics',
}

export default function DeckListView({ courseId, onBack, onNavigateDeck }: Props) {
  const [decks, setDecks] = useState<DeckMeta[]>([])
  const [deckStats, setDeckStats] = useState<Record<string, DeckStats>>({})
  const [analytics, setAnalytics] = useState<CourseAnalytics>({
    totalCards: 0,
    masteredCards: 0,
    dueTodayCards: 0,
    studiedTodayCards: 0,
    difficultCards: 0,
  })
  const [examDate, setExamDate] = useState('')
  const [isArchived, setIsArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const today = todayLocal()
    const allStates = getAllStates()
    const exam = getCourseExamSettings(courseId)
    setExamDate(exam.examDate)
    setIsArchived(exam.archived)

    fetch(dataUrl(`/data/${courseId}/index.json`))
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json() as Promise<CourseIndex>
      })
      .then(async (index) => {
        setDecks(index.decks)

        const statsMap: Record<string, DeckStats> = {}
        const nextAnalytics: CourseAnalytics = {
          totalCards: 0,
          masteredCards: 0,
          dueTodayCards: 0,
          studiedTodayCards: 0,
          difficultCards: 0,
        }

        await Promise.all(
          index.decks.map(async (deck) => {
            try {
              const dr = await fetch(dataUrl(`/data/${courseId}/${deck.file}`))
              if (!dr.ok) return
              const deckData = await dr.json()
              let total = 0
              let due = 0
              for (const card of deckData.cards ?? []) {
                total++
                nextAnalytics.totalCards++
                const key = getCardKey(courseId, deck.id, card.id)
                const state = allStates[key]
                if (!state) {
                  due++
                  nextAnalytics.dueTodayCards++
                  continue
                }

                if (state.reviewLog.some((entry) => entry.date === today)) {
                  nextAnalytics.studiedTodayCards++
                }

                if (wasDifficultOnDate(state, today)) {
                  nextAnalytics.difficultCards++
                }

                if (isMastered(state)) {
                  nextAnalytics.masteredCards++
                }

                if (isScheduledDue(state, today) || wasDifficultOnDate(state, today)) {
                  due++
                  nextAnalytics.dueTodayCards++
                }
              }
              statsMap[deck.id] = { total, due }
            } catch {
              statsMap[deck.id] = { total: 0, due: 0 }
            }
          }),
        )

        setDeckStats(statsMap)
        setAnalytics(nextAnalytics)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [courseId])

  const handleExamDateChange = (value: string) => {
    setExamDate(value)
    if (!value) {
      clearCourseExamDate(courseId)
      setIsArchived(false)
      return
    }
    saveCourseExamDate(courseId, value)
    setIsArchived(value < todayLocal())
  }

  const daysLeft = examDate ? daysBetween(todayLocal(), examDate) : null

  return (
    <div className="page">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>
          ← Retour
        </button>
        <h1 className="view-title">{COURSE_NAMES[courseId] ?? courseId}</h1>
      </header>

      <section className="exam-panel">
        <div className="exam-panel-head">
          <h2 className="exam-panel-title">Échéance d’examen</h2>
          {isArchived && <span className="badge-archived">Cours archivé</span>}
        </div>
        <div className="exam-controls">
          <input
            className="exam-date-input"
            type="date"
            value={examDate}
            onChange={(e) => handleExamDateChange(e.target.value)}
          />
          {examDate && (
            <button
              className="btn-secondary"
              onClick={() => handleExamDateChange('')}
            >
              Supprimer
            </button>
          )}
        </div>
        {!examDate && (
          <p className="exam-meta">Ajoutez une date pour activer la planification orientée examen.</p>
        )}
        {examDate && !isArchived && daysLeft !== null && (
          <p className="exam-meta">
            Examen le {examDate} · {daysLeft >= 0 ? `${daysLeft} jour(s) restant(s)` : 'date dépassée'}
          </p>
        )}
        {isArchived && (
          <p className="exam-meta">Le cours est masqué par défaut depuis l’accueil car l’examen est passé.</p>
        )}
      </section>

      <section className="analytics-panel">
        <h2 className="analytics-title">Analytics du cours</h2>
        <div className="analytics-grid">
          <div className="analytics-item">
            <span className="analytics-label">Maîtrisées</span>
            <strong className="analytics-value">
              {analytics.totalCards > 0
                ? `${Math.round((analytics.masteredCards / analytics.totalCards) * 100)}%`
                : '0%'}
            </strong>
          </div>
          <div className="analytics-item">
            <span className="analytics-label">À réviser aujourd’hui</span>
            <strong className="analytics-value">{analytics.dueTodayCards}</strong>
          </div>
          <div className="analytics-item">
            <span className="analytics-label">Étudiées aujourd’hui</span>
            <strong className="analytics-value">{analytics.studiedTodayCards}</strong>
          </div>
          <div className="analytics-item">
            <span className="analytics-label">Cartes difficiles</span>
            <strong className="analytics-value">{analytics.difficultCards}</strong>
          </div>
        </div>
      </section>

      <main className="deck-list">
        {loading && <p className="empty-state">Chargement…</p>}
        {error && <p className="empty-state error">Impossible de charger ce cours.</p>}
        {!loading && !error && decks.length === 0 && (
          <p className="empty-state">Aucune séance disponible pour ce cours.</p>
        )}
        {decks.map((deck) => {
          const s = deckStats[deck.id]
          return (
            <div key={deck.id} className="deck-item">
              <div className="deck-info">
                <h2 className="deck-title">{deck.title}</h2>
                {s && (
                  <p className="deck-meta">
                    {s.total} cartes
                    {!isArchived && s.due > 0 && (
                      <span className="badge-due"> · {s.due} à réviser aujourd'hui</span>
                    )}
                    {!isArchived && s.due === 0 && s.total > 0 && (
                      <span className="badge-done"> · À jour</span>
                    )}
                    {isArchived && <span className="badge-archived"> · Archivé</span>}
                  </p>
                )}
              </div>
              <button
                className="btn-start"
                onClick={() => onNavigateDeck(deck.id)}
                disabled={s?.total === 0 || isArchived}
              >
                {isArchived ? 'Archivé' : 'Commencer'}
              </button>
            </div>
          )
        })}
      </main>
    </div>
  )
}
