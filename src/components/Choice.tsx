import type { ReactNode } from 'react'

/**
 * Any item the trader picks from a list — release condition, funding source,
 * discrepancy reason. Oxide marks the live selection, never anything else.
 */
export function Choice({
  title,
  detail,
  meta,
  selected,
  onSelect,
  radio,
  snug,
  bright,
}: {
  title: ReactNode
  detail?: ReactNode
  meta?: ReactNode
  selected: boolean
  onSelect: () => void
  /** Shows an explicit ● / ○ — used where the choice funds money. */
  radio?: boolean
  snug?: boolean
  /** Keeps unselected options at full strength rather than dimming them. */
  bright?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className="choice"
      data-selected={selected ? 'true' : 'false'}
      data-pad={snug ? 'snug' : undefined}
      data-bright={bright && !selected ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className="choice__text">
        <span className="choice__title">{title}</span>
        {meta && <span className="choice__meta">{meta}</span>}
        {detail && <span className="choice__detail">{detail}</span>}
      </span>
      {radio && (
        <span className="choice__radio" aria-hidden="true">
          {selected ? '●' : '○'}
        </span>
      )}
    </button>
  )
}

export function ChoiceGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}

/** Buy or sell. It comes first because it drives everything after. */
export function Segmented({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          className="segmented__option"
          data-selected={value === option.id ? 'true' : 'false'}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
