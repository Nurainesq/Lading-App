import type { ReactNode } from 'react'

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

/** The single action that moves the deal forward. Reversed out of the ground. */
export function PrimaryButton({ children, onClick, disabled, type = 'button' }: ButtonProps) {
  return (
    <button className="btn btn--primary" onClick={onClick} disabled={disabled} type={type}>
      {children}
    </button>
  )
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  muted,
}: ButtonProps & { muted?: boolean }) {
  return (
    <button
      className="btn btn--secondary"
      data-muted={muted ? 'true' : undefined}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  onClick,
  compact,
}: ButtonProps & { compact?: boolean }) {
  return (
    <button
      className="btn btn--ghost"
      data-compact={compact ? 'true' : undefined}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

/** Footer action group, pinned to the bottom of a screen. */
export function Actions({ children, gap = 10 }: { children: ReactNode; gap?: number }) {
  return (
    <div className="spacer" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {children}
    </div>
  )
}
