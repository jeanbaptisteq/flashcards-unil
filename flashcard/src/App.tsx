import { useEffect, useState } from 'react'
import HomeView from './components/HomeView'
import DeckListView from './components/DeckListView'
import ReviewSession from './components/ReviewSession'
import {
  initializeCloudSync,
  requestMagicLink,
  signOutCloudSync,
  subscribeSyncStatus,
  type CloudSyncStatus,
} from './sync'

type View =
  | { type: 'home' }
  | { type: 'course'; courseId: string }
  | { type: 'review'; courseId: string; deckId: string }

export default function App() {
  const [view, setView] = useState<View>({ type: 'home' })
  const [email, setEmail] = useState('')
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({
    state: 'idle',
    email: '',
    message: '',
  })

  useEffect(() => {
    initializeCloudSync().catch((error: unknown) => {
      setSyncStatus({
        state: 'error',
        email: '',
        message: error instanceof Error ? error.message : 'Erreur de synchronisation.',
      })
    })
    return subscribeSyncStatus((status) => setSyncStatus(status))
  }, [])

  const handleSendMagicLink = async () => {
    if (!email.trim()) return
    await requestMagicLink(email.trim())
  }

  if (view.type === 'home') {
    return (
      <>
        <div className="sync-auth-strip">
          {syncStatus.state === 'auth_required' && (
            <div className="sync-auth-content">
              <span className="sync-auth-text">Sync cloud: connectez-vous</span>
              <input
                className="sync-auth-input"
                type="email"
                placeholder="votre email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn-secondary" onClick={handleSendMagicLink}>
                Envoyer le lien
              </button>
              {syncStatus.message && <span className="sync-auth-message">{syncStatus.message}</span>}
            </div>
          )}
          {(syncStatus.state === 'ok' || syncStatus.state === 'syncing') && (
            <div className="sync-auth-content">
              <span className="sync-auth-text">
                Sync cloud active {syncStatus.email ? `· ${syncStatus.email}` : ''}
              </span>
              <span className="sync-auth-message">{syncStatus.message}</span>
              <button className="btn-secondary" onClick={() => signOutCloudSync()}>
                Se déconnecter
              </button>
            </div>
          )}
          {syncStatus.state === 'error' && (
            <div className="sync-auth-content">
              <span className="sync-auth-text sync-auth-error">{syncStatus.message}</span>
            </div>
          )}
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
            Sync: {syncStatus.state === 'ok' || syncStatus.state === 'syncing' ? 'active' : 'inactive'}
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
            Sync: {syncStatus.state === 'ok' || syncStatus.state === 'syncing' ? 'active' : 'inactive'}
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
