import { useEffect, useState } from 'react'
import type { CourseIndex, DeckMeta } from '../types'
import { getAllStates } from '../store'
import { isDue, getCardKey } from '../scheduler'

interface DeckStats {
  total: number
  due: number
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const allStates = getAllStates()

    fetch(`/data/${courseId}/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error('not found')
        return r.json() as Promise<CourseIndex>
      })
      .then(async (index) => {
        setDecks(index.decks)

        const statsMap: Record<string, DeckStats> = {}

        await Promise.all(
          index.decks.map(async (deck) => {
            try {
              const dr = await fetch(`/data/${courseId}/${deck.file}`)
              if (!dr.ok) return
              const deckData = await dr.json()
              let total = 0
              let due = 0
              for (const card of deckData.cards ?? []) {
                total++
                const key = getCardKey(courseId, deck.id, card.id)
                const state = allStates[key]
                if (!state || isDue(state.sm2)) due++
              }
              statsMap[deck.id] = { total, due }
            } catch {
              statsMap[deck.id] = { total: 0, due: 0 }
            }
          }),
        )

        setDeckStats(statsMap)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [courseId])

  return (
    <div className="page">
      <header className="view-header">
        <button className="btn-back" onClick={onBack}>
          ← Retour
        </button>
        <h1 className="view-title">{COURSE_NAMES[courseId] ?? courseId}</h1>
      </header>

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
                    {s.due > 0 && (
                      <span className="badge-due"> · {s.due} à réviser aujourd'hui</span>
                    )}
                    {s.due === 0 && s.total > 0 && (
                      <span className="badge-done"> · À jour</span>
                    )}
                  </p>
                )}
              </div>
              <button
                className="btn-start"
                onClick={() => onNavigateDeck(deck.id)}
                disabled={s?.total === 0}
              >
                Commencer
              </button>
            </div>
          )
        })}
      </main>
    </div>
  )
}
