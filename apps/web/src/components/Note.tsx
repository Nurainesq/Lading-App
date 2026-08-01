import type { ReactNode } from 'react'

/**
 * An explanatory aside — the place the product explains itself in the trader's
 * language. Slate rule by default; oxide only when the note is about value
 * actually moving.
 */
export function Note({
  children,
  tone,
}: {
  children: ReactNode
  tone?: 'slate' | 'oxide'
}) {
  return (
    <div className="note" data-tone={tone === 'oxide' ? 'oxide' : undefined}>
      {children}
    </div>
  )
}

/** A fully boxed note with a mono heading — used for "what this means for you". */
export function BoxedNote({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="note" data-boxed="true">
      <span className="note__label">{label}</span>
      <span className="note__body">{children}</span>
    </div>
  )
}
