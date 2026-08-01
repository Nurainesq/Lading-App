import type { ReactNode } from 'react'
import { Logo } from './Logo'

export type Ground = 'ink' | 'paper'

/**
 * A 390×844 device screen. Everything inside reads its colours from the
 * ground, so the same primitives serve the buyer (ink) and the seller (paper).
 */
export function Screen({
  ground = 'ink',
  children,
  label,
}: {
  ground?: Ground
  children: ReactNode
  label?: string
}) {
  return (
    <section className="screen" data-ground={ground} aria-label={label}>
      {children}
    </section>
  )
}

/** Carrier chrome. Fixed at 9:41, as drawn. */
export function StatusBar() {
  return (
    <div className="statusbar" aria-hidden="true">
      <span>9:41</span>
      <span>◼◼◼ 100%</span>
    </div>
  )
}

export function NavBar({
  label,
  onBack,
  action,
}: {
  label: string
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <div className={`navbar${action ? ' navbar--spread' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
        {onBack && (
          <button type="button" className="navbar__back" onClick={onBack} aria-label="Back">
            ←
          </button>
        )}
        <span className="navbar__label">{label}</span>
      </div>
      {action}
    </div>
  )
}

export function AppBar({ ground = 'ink', action }: { ground?: Ground; action?: ReactNode }) {
  return (
    <div className="appbar">
      <div className="appbar__brand">
        <Logo field={ground === 'ink' ? 'slate' : 'ink'} />
        <span className="appbar__wordmark">Lading</span>
      </div>
      {action}
    </div>
  )
}

/** Marks a counterparty view. The seller must never mistake it for the buyer's. */
export function SellerBar({ location = 'DEIRA' }: { location?: string }) {
  return <div className="sellerbar">SELLER VIEW · {location}</div>
}

export function Content({
  children,
  pad,
  center,
  gap = 22,
}: {
  children: ReactNode
  pad?: 'roomy' | 'tight' | 'tightest' | 'flush'
  center?: true | 'between'
  gap?: number
}) {
  return (
    <div
      className="content"
      data-pad={pad}
      data-center={center === true ? 'true' : center}
      style={{ gap }}
    >
      {children}
    </div>
  )
}

export function Title({
  size,
  children,
  as: Tag = 'h1',
}: {
  size: 22 | 28 | 30 | 32 | 36 | 38 | 40 | 44
  children: ReactNode
  as?: 'h1' | 'h2' | 'div'
}) {
  return (
    <Tag className="title" data-size={size}>
      {children}
    </Tag>
  )
}
