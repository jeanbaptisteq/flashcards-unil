import type { CoursePdfRef } from '../types'

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function extractSessionNumber(value: string): string | null {
  const match = normalizeText(value).match(/(?:seance|session|quiz|cours)\s*(\d+)/)
  return match?.[1] ?? null
}

function isQuizSource(source: CoursePdfRef): boolean {
  return normalizeText(source.title).includes('quiz') || normalizeText(source.path).includes('quiz')
}

export function buildCourseSources(payload: {
  sourcePdf?: string | null
  sourcePdfs?: CoursePdfRef[]
}): CoursePdfRef[] {
  const sources = payload.sourcePdfs?.length
    ? [...payload.sourcePdfs]
    : payload.sourcePdf
      ? [{ title: 'Source du cours', path: payload.sourcePdf, kind: 'pdf' as const }]
      : []

  const deduped: CoursePdfRef[] = []
  const seen = new Set<string>()

  for (const source of sources) {
    if (!source?.path || seen.has(source.path)) continue
    seen.add(source.path)
    deduped.push(source)
  }

  return deduped
}

export function mergeCourseSources(...groups: Array<CoursePdfRef[] | null | undefined>): CoursePdfRef[] {
  const merged: CoursePdfRef[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const source of group ?? []) {
      if (!source?.path || seen.has(source.path)) continue
      seen.add(source.path)
      merged.push(source)
    }
  }

  return merged
}

export function selectSource(sources: CoursePdfRef[], hint?: string): CoursePdfRef {
  if (sources.length <= 1) return sources[0]

  const normalizedHint = hint ? normalizeText(hint) : ''
  const sessionNumber = hint ? extractSessionNumber(hint) : null

  if (sessionNumber) {
    const sessionSource = sources.find((source) => source.session === Number(sessionNumber))
    if (sessionSource) return sessionSource
  }

  if (normalizedHint.includes('quiz')) {
    const quizSource = sources.find((source) => isQuizSource(source))
    if (quizSource) return quizSource
  }

  return sources[0]
}

export function isMarkdownSource(source: CoursePdfRef): boolean {
  return source.kind === 'markdown' || source.path.toLowerCase().endsWith('.md')
}
