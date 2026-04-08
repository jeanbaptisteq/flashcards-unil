import { useEffect, useState } from 'react'
import { marked } from 'marked'
import type { CoursePdfRef } from '../types'
import { assetUrl } from '../utils/paths'
import { buildCourseSources, isMarkdownSource, selectSource } from '../utils/courseSources'

interface Props {
  title: string
  pdfPath?: string | null
  pdfs?: CoursePdfRef[]
  sourceHint?: string
  defaultExpanded?: boolean
  compact?: boolean
  inline?: boolean
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
  const sources = buildCourseSources({
    sourcePdfs: pdfs?.length ? pdfs : undefined,
    sourcePdf: pdfs?.length ? undefined : pdfPath,
  })
  const [markdownContent, setMarkdownContent] = useState('')
  const hintedSource = sources.length ? selectSource(sources, sourceHint) : null
  const initialActiveIndex = hintedSource
    ? Math.max(0, sources.findIndex((source) => source.path === hintedSource.path))
    : 0
  const [activeIndex, setActiveIndex] = useState(() => initialActiveIndex)
  const activeSource = sources.length
    ? inline && hintedSource
      ? hintedSource
      : sources[Math.min(activeIndex, sources.length - 1)]
    : null
  const resolvedPath = activeSource ? assetUrl(activeSource.path) : ''
  const isMarkdown = activeSource ? isMarkdownSource(activeSource) : false
  const openLabel = isMarkdown ? 'Ouvrir le Markdown' : 'Ouvrir le PDF'

  useEffect(() => {
    let cancelled = false

    if (!isMarkdown) {
      setMarkdownContent('')
      return
    }

    fetch(resolvedPath)
      .then((response) => {
        if (!response.ok) throw new Error('not found')
        return response.text()
      })
      .then((text) => {
        if (!cancelled) setMarkdownContent(text)
      })
      .catch(() => {
        if (!cancelled) setMarkdownContent('')
      })

    return () => {
      cancelled = true
    }
  }, [isMarkdown, resolvedPath])

  const markdownHtml = isMarkdown && markdownContent ? String(marked.parse(markdownContent)) : ''

  if (!activeSource) return null

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
            {openLabel}
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
          {isMarkdown ? (
            markdownContent ? (
              <div className="course-markdown-view">
                <div className="course-markdown-toolbar">
                  <span className="course-markdown-chip">Markdown</span>
                  <a
                    className="course-markdown-link"
                    href={resolvedPath}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ouvrir le Markdown
                  </a>
                </div>
                <article
                  className="course-markdown-content"
                  dangerouslySetInnerHTML={{ __html: markdownHtml }}
                />
              </div>
            ) : (
              <div className="course-markdown-loading">Chargement du markdown…</div>
            )
          ) : (
            <iframe
              className="course-pdf-frame"
              src={resolvedPath}
              title={activeSource.title}
              loading="lazy"
            />
          )}
        </div>
      )}
    </section>
  )
}
