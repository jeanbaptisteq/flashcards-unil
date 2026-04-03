import { useState } from 'react'
import type { CoursePdfRef } from '../types'
import { assetUrl } from '../utils/paths'

interface Props {
  title: string
  pdfPath?: string | null
  pdfs?: CoursePdfRef[]
  sourceHint?: string
  defaultExpanded?: boolean
  compact?: boolean
  inline?: boolean
}

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

function selectSource(sources: CoursePdfRef[], hint?: string): CoursePdfRef {
  if (sources.length <= 1) return sources[0]

  const normalizedHint = hint ? normalizeText(hint) : ''
  const sessionNumber = hint ? extractSessionNumber(hint) : null

  if (sessionNumber) {
    const courseMatch = sources.find((source) => {
      const normalizedTitle = normalizeText(source.title)
      const normalizedPath = normalizeText(source.path)
      return (
        normalizedPath.includes(`cours${sessionNumber}`) ||
        normalizedTitle.includes(`cours ${sessionNumber}`) ||
        normalizedTitle.includes(`cours${sessionNumber}`)
      )
    })
    if (courseMatch) return courseMatch

    const quizMatch = sources.find((source) => {
      const normalizedTitle = normalizeText(source.title)
      const normalizedPath = normalizeText(source.path)
      return (
        normalizedPath.includes(`quiz${sessionNumber}`) ||
        (normalizedTitle.includes('quiz') && normalizedPath.includes(sessionNumber))
      )
    })
    if (quizMatch) return quizMatch
  }

  if (normalizedHint.includes('quiz')) {
    const quizSource = sources.find((source) => normalizeText(source.title).includes('quiz'))
    if (quizSource) return quizSource
  }

  return sources[0]
}

export default function CoursePdfPanel({
  title,
  pdfPath,
  pdfs,
  sourceHint,
  defaultExpanded = true,
  compact = false,
  inline = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const sources = pdfs?.length ? pdfs : pdfPath ? [{ title, path: pdfPath }] : []

  if (sources.length === 0) return null

  const hintedSource = selectSource(sources, sourceHint)
  const initialActiveIndex = Math.max(0, sources.findIndex((source) => source.path === hintedSource.path))
  const [activeIndex, setActiveIndex] = useState(() => initialActiveIndex)
  const activeSource = inline ? hintedSource : sources[Math.min(activeIndex, sources.length - 1)]
  const resolvedPath = assetUrl(activeSource.path)

  if (inline) {
    return (
      <div className="course-pdf-inline">
        <span className="course-pdf-inline-chip" title={activeSource.title}>
          {activeSource.title}
        </span>
        <a
          className="course-pdf-inline-link"
          href={resolvedPath}
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir
        </a>
      </div>
    )
  }

  return (
    <section
      className={[
        'course-pdf-panel',
        compact ? 'compact' : '',
        inline ? 'inline' : '',
        isExpanded ? 'expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="course-pdf-head">
        <div className="course-pdf-title-wrap">
          {inline && <span className="course-pdf-chip">PDF du cours</span>}
          <h2 className="course-pdf-title">{title}</h2>
          <p className="course-pdf-meta">
            {inline
              ? sources.length > 1
                ? activeSource.title
                : 'Source de cours compacte.'
              : 'Consultez la source de cours sans quitter l’app.'}
          </p>
        </div>
        <div className="course-pdf-actions">
          <button
            type="button"
            className="btn-secondary course-pdf-toggle"
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? 'Masquer' : 'Afficher'}
          </button>
          <a
            className="btn-secondary course-pdf-link"
            href={resolvedPath}
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir le PDF
          </a>
        </div>
      </div>

      {sources.length > 1 && (
        <div className="course-pdf-tabs" role="tablist" aria-label={title}>
          {sources.map((source, index) => (
            <button
              key={`${source.path}-${index}`}
              type="button"
              className={`course-pdf-tab${index === activeIndex ? ' active' : ''}`}
              onClick={() => setActiveIndex(index)}
            >
              {source.title}
            </button>
          ))}
        </div>
      )}

      {isExpanded && (
        <div className="course-pdf-frame-wrap">
          <iframe
            className="course-pdf-frame"
            src={resolvedPath}
            title={activeSource.title}
            loading="lazy"
          />
        </div>
      )}
    </section>
  )
}
