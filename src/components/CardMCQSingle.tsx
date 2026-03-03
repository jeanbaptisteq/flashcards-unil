import type { MCQSingleCard } from '../types'

interface Props {
  card: MCQSingleCard
  phase: 'question' | 'answer'
  selected: string[]
  isCorrect: boolean | null
  onSelect: (ids: string[]) => void
}

export default function CardMCQSingle({ card, phase, selected, isCorrect, onSelect }: Props) {
  const selectedId = selected[0] ?? null

  function optionClass(optId: string): string {
    if (phase === 'question') {
      return selectedId === optId ? 'option selected' : 'option'
    }
    // Answer phase
    const isCorrectOpt = card.correct.includes(optId)
    const isSelected = selectedId === optId
    if (isCorrectOpt) return 'option correct'
    if (isSelected && !isCorrectOpt) return 'option incorrect'
    return 'option'
  }

  return (
    <div className="card-content">
      {card.image_front && (
        <img src={card.image_front} alt="Illustration" className="card-image" />
      )}
      <p className="card-question">{card.question}</p>

      <div className="options-list">
        {card.options.map((opt) => (
          <button
            key={opt.id}
            className={optionClass(opt.id)}
            onClick={() => phase === 'question' && onSelect([opt.id])}
            disabled={phase === 'answer'}
          >
            <span className="option-id">{opt.id}</span>
            <span className="option-text">{opt.text}</span>
            {phase === 'answer' && card.correct.includes(opt.id) && (
              <span className="option-marker correct-marker">✓</span>
            )}
            {phase === 'answer' && selectedId === opt.id && !card.correct.includes(opt.id) && (
              <span className="option-marker incorrect-marker">✗</span>
            )}
          </button>
        ))}
      </div>

      {phase === 'answer' && (
        <div className={`feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}`}>
          <p className="feedback-status">{isCorrect ? 'Correct !' : 'Incorrect'}</p>
          <p className="feedback-explanation">{card.explanation}</p>
        </div>
      )}
    </div>
  )
}
