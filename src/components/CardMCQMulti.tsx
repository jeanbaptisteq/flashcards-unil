import type { MCQMultiCard } from '../types'

interface Props {
  card: MCQMultiCard
  phase: 'question' | 'answer'
  selected: string[]
  isCorrect: boolean | null
  onSelect: (ids: string[]) => void
}

export default function CardMCQMulti({ card, phase, selected, isCorrect, onSelect }: Props) {
  function toggle(optId: string) {
    if (phase !== 'question') return
    if (selected.includes(optId)) {
      onSelect(selected.filter((id) => id !== optId))
    } else {
      onSelect([...selected, optId])
    }
  }

  function optionClass(optId: string): string {
    if (phase === 'question') {
      return selected.includes(optId) ? 'option selected' : 'option'
    }
    const isCorrectOpt = card.correct.includes(optId)
    const isSelected = selected.includes(optId)
    if (isCorrectOpt && isSelected) return 'option correct'
    if (isCorrectOpt && !isSelected) return 'option missed'
    if (!isCorrectOpt && isSelected) return 'option incorrect'
    return 'option'
  }

  return (
    <div className="card-content">
      {card.image_front && (
        <img src={card.image_front} alt="Illustration" className="card-image" />
      )}
      <p className="card-question">{card.question}</p>
      <p className="card-hint">Plusieurs réponses possibles</p>

      <div className="options-list">
        {card.options.map((opt) => (
          <button
            key={opt.id}
            className={optionClass(opt.id)}
            onClick={() => toggle(opt.id)}
            disabled={phase === 'answer'}
          >
            <span className="option-checkbox">
              {selected.includes(opt.id) ? '☑' : '☐'}
            </span>
            <span className="option-id">{opt.id}</span>
            <span className="option-text">{opt.text}</span>
            {phase === 'answer' && card.correct.includes(opt.id) && !selected.includes(opt.id) && (
              <span className="option-marker missed-marker">!</span>
            )}
            {phase === 'answer' && card.correct.includes(opt.id) && selected.includes(opt.id) && (
              <span className="option-marker correct-marker">✓</span>
            )}
            {phase === 'answer' && !card.correct.includes(opt.id) && selected.includes(opt.id) && (
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
