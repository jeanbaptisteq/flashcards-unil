import type { NumericInputCard } from '../types'
import { assetUrl } from '../utils/paths'

interface Props {
  card: NumericInputCard
  phase: 'question' | 'answer'
  selected: string
  isCorrect: boolean | null
  onSelect: (val: string) => void
}

export default function CardNumericInput({ card, phase, selected, isCorrect, onSelect }: Props) {
  return (
    <div className="card-content">
      {card.image_front && (
        <img src={assetUrl(card.image_front)} alt="Illustration" className="card-image" />
      )}
      <p className="card-question">{card.question}</p>

      {card.prompt && <p className="dropdown-prompt">{card.prompt}</p>}

      {phase === 'question' ? (
        <input
          className="numeric-input-field"
          type="text"
          inputMode="decimal"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          placeholder={card.placeholder ?? 'Tape ta réponse numérique'}
        />
      ) : (
        <>
          <div className={`feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
            <p className="feedback-status">
              {isCorrect ? 'Correct !' : `Incorrect — bonne réponse : ${card.correct}`}
            </p>
            <p className="feedback-explanation">{card.explanation}</p>
          </div>
        </>
      )}
    </div>
  )
}
