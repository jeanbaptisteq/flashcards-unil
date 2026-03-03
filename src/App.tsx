import { useState } from 'react'
import HomeView from './components/HomeView'
import DeckListView from './components/DeckListView'
import ReviewSession from './components/ReviewSession'

type View =
  | { type: 'home' }
  | { type: 'course'; courseId: string }
  | { type: 'review'; courseId: string; deckId: string }

export default function App() {
  const [view, setView] = useState<View>({ type: 'home' })

  if (view.type === 'home') {
    return (
      <HomeView
        onNavigateCourse={(courseId) => setView({ type: 'course', courseId })}
      />
    )
  }

  if (view.type === 'course') {
    return (
      <DeckListView
        courseId={view.courseId}
        onBack={() => setView({ type: 'home' })}
        onNavigateDeck={(deckId) =>
          setView({ type: 'review', courseId: view.courseId, deckId })
        }
      />
    )
  }

  if (view.type === 'review') {
    return (
      <ReviewSession
        courseId={view.courseId}
        deckId={view.deckId}
        onBack={() => setView({ type: 'course', courseId: view.courseId })}
      />
    )
  }

  return null
}
