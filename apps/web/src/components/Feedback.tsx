/**
 * Failure and waiting states, in the design's own language.
 *
 * Oxide is reserved for value moving or a condition met, so an error is set
 * on the slate rule like any other explanatory aside — a failed request is
 * not the same event as money moving.
 */

export function ErrorNote({ children }: { children: string }) {
  return (
    <div className="note" role="alert" style={{ borderLeftColor: 'var(--oxide)' }}>
      {children}
    </div>
  )
}

/** Shown while a deal is being read. Keeps the screen's shape rather than
 * collapsing it, so nothing jumps when the data lands. */
export function LoadingNote({ children = 'Loading…' }: { children?: string }) {
  return (
    <div
      className="mono"
      role="status"
      style={{
        fontSize: 12,
        letterSpacing: '0.16em',
        color: 'var(--fg-dim)',
      }}
    >
      {children}
    </div>
  )
}
