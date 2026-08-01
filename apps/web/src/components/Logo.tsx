/**
 * The Lading mark: a manifest — three lines of cargo, the last one released.
 * The oxide bar is the released line, so the "one colour" variant (used where
 * the mark is reproduced on a document) drops it back to paper.
 */
export function Logo({
  size = 26,
  field = 'slate',
  oneColour = false,
}: {
  size?: number
  /** The mark sits on slate in the app, on ink when reversed onto paper. */
  field?: 'slate' | 'ink'
  /** Flattens the released bar to paper, for print-style reproduction. */
  oneColour?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Lading"
      focusable="false"
    >
      <rect width="64" height="64" fill={field === 'slate' ? '#1f3a4d' : '#16181a'} />
      <rect x="14" y="16" width="36" height="8" fill="#f4f1ea" />
      <rect x="14" y="28" width="26" height="8" fill="#f4f1ea" />
      <rect x="14" y="40" width="36" height="8" fill={oneColour ? '#f4f1ea' : '#8a3a24'} />
    </svg>
  )
}
