import type { DropdownCard } from '../types'
import { assetUrl } from '../utils/paths'

interface Props {
  card: DropdownCard
  phase: 'question' | 'answer'
  selected: string
  isCorrect: boolean | null
  onSelect: (val: string) => void
}

export default function CardDropdown({ card, phase, selected, isCorrect, onSelect }: Props) {
  const parts = card.prompt.split('____')

  return (
    <div className="card-content">
      {card.image_front && (
        <img src={assetUrl(card.image_front)} alt="Illustration" className="card-image" />
      )}
      <p className="card-question">{card.question}</p>

      <div className="dropdown-prompt">
        <span>{parts[0]}</span>
        {phase === 'question' ? (
          <select
            className="dropdown-select"
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
          >
            <option value="">— choisir —</option>
            {card.choices.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <span className={`dropdown-answer ${isCorrect ? 'answer-correct' : 'answer-incorrect'}`}>
            {selected || '—'}
          </span>
        )}
        {parts[1] && <span>{parts[1]}</span>}
      </div>

      {phase === 'answer' && (
        <div className={`feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
          <p className="feedback-status">
            {isCorrect ? 'Correct !' : `Incorrect — bonne réponse : ${card.correct}`}
          </p>
          <p className="feedback-explanation">{card.explanation}</p>
        </div>
      )}
    </div>
  )
}
