/** Multi-step form progress. Oxide fills what is behind you. */
export function Steps({ total, done }: { total: number; done: number }) {
  return (
    <div className="steps" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="steps__step" data-done={i < done ? 'true' : 'false'} />
      ))}
    </div>
  )
}

/** The voyage, as a bar between two ports. */
export function Meter({
  percent,
  from,
  to,
}: {
  percent: number
  from: string
  to: string
}) {
  return (
    <>
      <div
        className="meter"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${from} to ${to}`}
      >
        <div className="meter__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="meter__ends">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </>
  )
}
