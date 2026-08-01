/** FUNDED / RELEASED. Stamped like a docket — the design is explicit that this
 * moment is recorded, not celebrated. */
export function Stamp({ children, size }: { children: string; size?: 'sm' }) {
  return (
    <div className="stamp" data-size={size}>
      {children}
    </div>
  )
}
