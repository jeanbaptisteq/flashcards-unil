import type { ImageRecallCard } from '../types'
import { assetUrl } from '../utils/paths'

interface Props {
  card: ImageRecallCard
  phase: 'question' | 'answer'
}

export default function CardImageRecall({ card, phase }: Props) {
  return (
    <div className="card-content">
      <p className="card-question">{card.question}</p>
      {card.prompt && <p className="card-hint">{card.prompt}</p>}

      <div className="image-recall-wrap">
        <img src={assetUrl(card.image)} alt="Slide" className="card-image card-image-large" />
      </div>

      {phase === 'answer' && (
        <div className="feedback-box feedback-neutral">
          <p className="feedback-answer">{card.answer}</p>
          <p className="feedback-explanation">{card.explanation}</p>
        </div>
      )}
    </div>
  )
}
