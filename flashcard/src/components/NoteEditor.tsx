import { useState, useEffect, useCallback, useRef } from 'react'
import { getCardState, saveNote } from '../store'

interface Props {
  cardKey: string
}

export default function NoteEditor({ cardKey }: Props) {
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load note when cardKey changes
  useEffect(() => {
    const state = getCardState(cardKey)
    setNote(state.note)
    setSaved(false)
  }, [cardKey])

  const handleChange = useCallback(
    (val: string) => {
      setNote(val)
      setSaved(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        saveNote(cardKey, val)
        setSaved(true)
      }, 500)
    },
    [cardKey],
  )

  return (
    <div className="note-editor">
      <div className="note-header">
        <span className="note-label">Mes notes</span>
        {saved && <span className="note-saved">Sauvegardé</span>}
      </div>
      <textarea
        className="note-textarea"
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Ajouter une note personnelle sur cette carte…"
        rows={3}
      />
    </div>
  )
}
