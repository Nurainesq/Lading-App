export type TimelineState = 'done' | 'current' | 'pending'

export interface TimelineEntry {
  label: string
  meta: string
  state: TimelineState
}

/** The 26 days, as a ledger of what has happened and what is still owed. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {entries.map((entry, i) => {
        const pending = entry.state === 'pending'
        return (
          <li className="timeline__item" key={entry.label}>
            <div className="timeline__rail">
              <div className="timeline__node" data-state={entry.state} />
              {i < entries.length - 1 && <div className="timeline__line" />}
            </div>
            <div className="timeline__text">
              <span className="timeline__label" data-pending={pending ? 'true' : undefined}>
                {entry.label}
              </span>
              <span className="timeline__meta" data-pending={pending ? 'true' : undefined}>
                {entry.meta}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
