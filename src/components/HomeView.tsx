import { useEffect, useState } from 'react'
import type { CourseIndex } from '../types'
import { getAllCourseExamSettings, getAllStates } from '../store'
import { getCardKey, isScheduledDue, wasDifficultOnDate } from '../scheduler'
import { dataUrl } from '../utils/paths'
import { daysBetween, todayLocal } from '../utils/date'

const COURSES = [
  { id: 'controle-gestion', name: 'Contrôle de gestion', color: '#2563eb' },
  { id: 'gestion-operations', name: 'Gestion des opérations', color: '#7c3aed' },
  { id: 'leadership', name: 'Leadership', color: '#dc2626' },
  { id: 'bia', name: 'Business Intelligence & Analytics', color: '#0d9488' },
]

interface CourseStats {
  totalDecks: number
  totalCards: number
  dueCards: number
  archived: boolean
  examDate: string
}

interface Props {
  onNavigateCourse: (courseId: string) => void
}

export default function HomeView({ onNavigateCourse }: Props) {
  const [stats, setStats] = useState<Record<string, CourseStats>>({})
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    const today = todayLocal()
    const allStates = getAllStates()
    const examByCourse = getAllCourseExamSettings()

    Promise.all(
      COURSES.map(async (course) => {
        const exam = examByCourse[course.id]
        const archived = Boolean(exam?.archived)
        const examDate = exam?.examDate ?? ''
        try {
          const res = await fetch(dataUrl(`/data/${course.id}/index.json`))
          if (!res.ok) {
            return {
              id: course.id,
              stats: { totalDecks: 0, totalCards: 0, dueCards: 0, archived, examDate },
            }
          }
          const index: CourseIndex = await res.json()

          let totalCards = 0
          let dueCards = 0

          await Promise.all(
            index.decks.map(async (deck) => {
              try {
                const dr = await fetch(dataUrl(`/data/${course.id}/${deck.file}`))
                if (!dr.ok) return
                const deckData = await dr.json()
                for (const card of deckData.cards ?? []) {
                  totalCards++
                  const key = getCardKey(course.id, deck.id, card.id)
                  const state = allStates[key]
                  if (!state || isScheduledDue(state, today) || wasDifficultOnDate(state, today)) {
                    dueCards++
                  }
                }
              } catch {
                // ignore missing deck files
              }
            }),
          )

          return {
            id: course.id,
            stats: { totalDecks: index.decks.length, totalCards, dueCards, archived, examDate },
          }
        } catch {
          return {
            id: course.id,
            stats: { totalDecks: 0, totalCards: 0, dueCards: 0, archived, examDate },
          }
        }
      }),
    ).then((results) => {
      const map: Record<string, CourseStats> = {}
      for (const r of results) map[r.id] = r.stats
      setStats(map)
    })
  }, [])

  return (
    <div className="page">
      <header className="app-header">
        <h1 className="app-title">Flashcards UNIL</h1>
        <p className="app-subtitle">Révision par cours &amp; séance</p>
        <label className="archived-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          <span>Afficher les cours archivés (examen passé)</span>
        </label>
      </header>

      <main className="course-grid">
        {COURSES.filter((course) => {
          const s = stats[course.id]
          return showArchived || !s?.archived
        }).map((course) => {
          const s = stats[course.id]
          const isArchived = Boolean(s?.archived)
          const daysLeft = s?.examDate ? daysBetween(todayLocal(), s.examDate) : 0
          return (
            <button
              key={course.id}
              className="course-card"
              style={{ '--course-color': course.color } as React.CSSProperties}
              onClick={() => onNavigateCourse(course.id)}
            >
              <div className="course-card-accent" />
              <div className="course-card-body">
                <h2 className="course-name">{course.name}</h2>
                {s ? (
                  <div className="course-stats">
                    <span className="stat">{s.totalDecks} séance{s.totalDecks !== 1 ? 's' : ''}</span>
                    <span className="stat-sep">·</span>
                    <span className="stat">{s.totalCards} cartes</span>
                    {isArchived && (
                      <>
                        <span className="stat-sep">·</span>
                        <span className="stat badge-archived">Archivé</span>
                      </>
                    )}
                    {!isArchived && s.examDate && (
                      <>
                        <span className="stat-sep">·</span>
                        <span className="stat">
                          Examen {daysLeft >= 0 ? `dans ${daysLeft}j` : 'passé'}
                        </span>
                      </>
                    )}
                    {s.dueCards > 0 && (
                      <>
                        <span className="stat-sep">·</span>
                        <span className="stat stat-due">{s.dueCards} à réviser</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="course-stats">
                    <span className="stat stat-loading">Chargement…</span>
                  </div>
                )}
              </div>
              <div className="course-card-arrow">›</div>
            </button>
          )
        })}
      </main>
    </div>
  )
}
