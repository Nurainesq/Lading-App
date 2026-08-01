import type { ReactNode } from 'react'

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="field__label">{children}</div>
}

/** Label + control + optional hint. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="field">
      <FieldLabel>{label}</FieldLabel>
      {children}
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  mono,
  placeholder,
  label,
  inputMode,
}: {
  value: string
  onChange: (next: string) => void
  mono?: boolean
  placeholder?: string
  label: string
  inputMode?: 'text' | 'tel' | 'numeric' | 'decimal'
}) {
  return (
    <div className="field__box" data-mono={mono ? 'true' : undefined}>
      <input
        className="field__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        inputMode={inputMode}
      />
    </div>
  )
}

/** A field that opens a picker. Rendered as a control, not a native select. */
export function SelectBox({
  value,
  label,
  onClick,
}: {
  value: string
  label: string
  onClick?: () => void
}) {
  return (
    <button className="field__box" type="button" onClick={onClick} aria-label={label}>
      <span>{value}</span>
      <span className="field__chevron" aria-hidden="true">
        ▾
      </span>
    </button>
  )
}

/** The deal value. Larger, because it is the point of the screen. */
export function AmountInput({
  value,
  onChange,
  currency,
}: {
  value: string
  onChange: (next: string) => void
  currency: string
}) {
  return (
    <div className="field__box field__box--amount">
      <input
        className="amount"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Deal value"
        inputMode="decimal"
      />
      <span className="mono" style={{ fontSize: 15, color: 'var(--fg-dim)' }}>
        {currency} ▾
      </span>
    </div>
  )
}
