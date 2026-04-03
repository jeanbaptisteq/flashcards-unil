export type CardType = 'mcq_single' | 'mcq_multi' | 'image_recall' | 'dropdown' | 'numeric_input'

export interface CardOption {
  id: string
  text: string
}

interface BaseCard {
  id: string
  type: CardType
  question: string
  explanation: string
  image_front?: string | null
  image_back?: string | null
}

export interface MCQSingleCard extends BaseCard {
  type: 'mcq_single'
  options: CardOption[]
  correct: string[]
}

export interface MCQMultiCard extends BaseCard {
  type: 'mcq_multi'
  options: CardOption[]
  correct: string[]
}

export interface ImageRecallCard extends BaseCard {
  type: 'image_recall'
  prompt?: string
  image: string
  answer: string
}

export interface DropdownCard extends BaseCard {
  type: 'dropdown'
  prompt: string
  choices: string[]
  correct: string
}

export interface NumericInputCard extends BaseCard {
  type: 'numeric_input'
  prompt?: string
  placeholder?: string
  correct: string
  accepted?: string[]
}

export type Card = MCQSingleCard | MCQMultiCard | ImageRecallCard | DropdownCard | NumericInputCard

export interface Deck {
  id: string
  course: string
  lesson: string
  cards: Card[]
}

export interface DeckMeta {
  id: string
  title: string
  file: string
}

export interface CourseIndex {
  id: string
  name: string
  color: string
  sourcePdf?: string | null
  sourcePdfs?: CoursePdfRef[]
  decks: DeckMeta[]
}

export interface CoursePdfRef {
  title: string
  path: string
}

export interface SM2State {
  interval: number
  easeFactor: number
  dueDate: string
  reps: number
}

export type QueueState = 'new' | 'learning' | 'review' | 'relearning'

export interface ReviewLogEntry {
  date: string
  rating: Rating
}

export interface CardPerformance {
  againCount: number
  hardCount: number
  totalRated: number
  recentRatings: Rating[]
}

export interface ExamProgress {
  examDateTracked: string
  reviewsInExamCycle: number
  lastReviewedOn: string
}

export interface UserCardState {
  note: string
  sm2: SM2State
  queueState: QueueState
  lastReviewedOn: string
  reviewLog: ReviewLogEntry[]
  performance: CardPerformance
  examProgress: ExamProgress
}

export interface CourseExamSettings {
  examDate: string
  archived: boolean
  updatedAt: string
}

export type Rating = 0 | 1 | 2 | 3
