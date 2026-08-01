import type { ReactNode } from 'react'

/**
 * A trade document in a list: supplied, or still to come.
 * Dashed means "not here yet" — the only affordance that invites an upload.
 */
export function DocumentRow({
  name,
  meta,
  state = 'done',
  action,
  onClick,
  roomy,
}: {
  name: string
  meta: ReactNode
  state?: 'done' | 'strong' | 'empty'
  /** Shown on the right: a status once supplied, an invitation while empty. */
  action?: ReactNode
  onClick?: () => void
  roomy?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className="doc"
      data-state={state}
      data-pad={roomy ? 'roomy' : undefined}
      onClick={onClick}
      {...(onClick ? { type: 'button' as const } : {})}
    >
      <span className="doc__text">
        <span className="doc__name">{name}</span>
        <span className="doc__meta">{meta}</span>
      </span>
      {action}
    </Tag>
  )
}

export function DocStatus({ children }: { children: ReactNode }) {
  return <span className="doc__status">{children}</span>
}

export function DocAction({ children }: { children: ReactNode }) {
  return <span className="doc__action">{children}</span>
}
