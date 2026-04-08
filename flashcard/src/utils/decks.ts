import type { DeckMeta } from '../types'

function normalizeDeckId(deckId: string): string {
  return deckId.toLowerCase().replace(/^quiz-/, '').replace(/-quiz$/, '')
}

function isQuizDeck(deckId: string): boolean {
  return deckId.toLowerCase().startsWith('quiz-') || deckId.toLowerCase().endsWith('-quiz')
}

export function filterDuplicateDecks(decks: DeckMeta[]): DeckMeta[] {
  const hasQuizByTopic = new Set<string>()
  for (const deck of decks) {
    if (isQuizDeck(deck.id)) {
      hasQuizByTopic.add(normalizeDeckId(deck.id))
    }
  }

  return decks.filter((deck) => {
    const topic = normalizeDeckId(deck.id)
    if (!hasQuizByTopic.has(topic)) return true
    return isQuizDeck(deck.id)
  })
}
