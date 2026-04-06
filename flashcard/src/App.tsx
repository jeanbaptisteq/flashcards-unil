import { useEffect, useState } from 'react'
import HomeView from './components/HomeView'
import DeckListView from './components/DeckListView'
import ReviewSession from './components/ReviewSession'
import { initializeCloudSync, subscribeSyncStatus, type CloudSyncStatus } from './sync'

type View =
  | { type: 'home' }
  | { type: 'course'; courseId: string }
  | { type: 'review'; courseId: string; deckId: string }

export default function App() {
  const [view, setView] = useState<View>({ type: 'home' })
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    state: 'idle',
    message: '',
  })

  useEffect(() => {
    initializeCloudSync().catch((error: unknown) => {
      setSyncStatus({
        state: 'unavailable',
        message:
          error instanceof Error
            ? error.message
            : 'Synchronisation Supabase indisponible.',
      })
    })
    return subscribeSyncStatus((status) => setSyncStatus(status))
  }, [])

  const syncLabel =
    syncStatus.state === 'syncing'
      ? 'Synchronisation Supabase en cours…'
      : syncStatus.state === 'unavailable'
        ? 'Sync Supabase indisponible'
        : 'Sync Supabase active'

  if (view.type === 'home') {
    return (
      <>
        <div className="sync-auth-strip">
          <div className="sync-auth-content">
            <span className="sync-auth-text">{syncLabel}</span>
            {syncStatus.message && syncStatus.state !== 'unavailable' && (
              <span className="sync-auth-message">{syncStatus.message}</span>
            )}
          </div>
        </div>
        <HomeView
          onNavigateCourse={(courseId) => setView({ type: 'course', courseId })}
        />
      </>
    )
  }

  if (view.type === 'course') {
    return (
      <>
        <div className="sync-auth-strip compact">
          <span className="sync-auth-text">
            {syncStatus.state === 'syncing'
              ? 'Synchronisation Supabase en cours…'
              : syncStatus.state === 'unavailable'
                ? 'Sync Supabase indisponible'
                : 'Sync Supabase active'}
          </span>
        </div>
        <DeckListView
          courseId={view.courseId}
          onBack={() => setView({ type: 'home' })}
          onNavigateDeck={(deckId) =>
            setView({ type: 'review', courseId: view.courseId, deckId })
          }
        />
      </>
    )
  }

  if (view.type === 'review') {
    return (
      <>
        <div className="sync-auth-strip compact">
          <span className="sync-auth-text">
            {syncStatus.state === 'syncing'
              ? 'Synchronisation Supabase en cours…'
              : syncStatus.state === 'unavailable'
                ? 'Sync Supabase indisponible'
                : 'Sync Supabase active'}
          </span>
        </div>
        <ReviewSession
          courseId={view.courseId}
          deckId={view.deckId}
          onBack={() => setView({ type: 'course', courseId: view.courseId })}
        />
      </>
    )
  }

  return null
}
