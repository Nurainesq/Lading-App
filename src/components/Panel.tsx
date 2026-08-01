import type { ReactNode } from 'react'

/** A bordered block of facts. */
export function Panel({
  children,
  tone,
  plain,
}: {
  children: ReactNode
  tone?: 'strong' | 'oxide'
  plain?: boolean
}) {
  return (
    <div className="panel" data-tone={tone} data-plain={plain ? 'true' : undefined}>
      {children}
    </div>
  )
}

export function PanelRow({
  label,
  value,
  mono,
  tone,
  roomy,
  labelMuted,
}: {
  label: ReactNode
  value: ReactNode
  mono?: boolean
  /** Oxide is reserved for a value that has actually moved or settled. */
  tone?: 'oxide'
  roomy?: boolean
  /** Lifts the label out of "dim" — used where the row is a check, not an aside. */
  labelMuted?: boolean
}) {
  return (
    <div className="panel__row" data-pad={roomy ? 'roomy' : undefined}>
      <span className="panel__label" data-muted={labelMuted ? 'true' : undefined}>
        {label}
      </span>
      <span
        className={`panel__value${mono ? ' mono' : ''}`}
        style={tone === 'oxide' ? { color: 'var(--oxide)' } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

/** A stacked key/value inside a panel body — used for the escrow account. */
export function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="caption">{label}</span>
      {children}
    </div>
  )
}

export function Rule() {
  return <div className="rule" />
}
