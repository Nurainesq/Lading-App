import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar } from '@/components/Screen'
import { SecondaryButton } from '@/components/Button'
import { Meter } from '@/components/Progress'
import { Timeline, type TimelineEntry } from '@/components/Timeline'
import { deal as fixture } from '@/data/deal'

const entries: TimelineEntry[] = [
  { label: 'Escrow funded', meta: fixture.dates.fundedShort, state: 'done' },
  { label: 'Seller confirmed shipment', meta: fixture.dates.shipmentConfirmed, state: 'done' },
  {
    label: 'Vessel at sea',
    meta: `DAY ${fixture.dayOfWindow} OF ${fixture.windowDays}`,
    state: 'current',
  },
  { label: 'Bill of lading presented', meta: 'AWAITING SELLER', state: 'pending' },
  { label: 'Funds released', meta: 'ON VERIFICATION', state: 'pending' },
]

/**
 * 11 — The 26 days, where trust normally decays. The FX line quietly proves the
 * product's core claim mid-voyage, without anyone having to ask.
 */
export function DealTimeline() {
  const navigate = useNavigate()

  return (
    <Screen label={`Deal ${fixture.reference}`}>
      <StatusBar />
      <NavBar
        label={fixture.reference}
        action={
          <span
            className="mono"
            style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--oxide)' }}
          >
            IN TRANSIT · DAY {fixture.dayOfWindow}/{fixture.windowDays}
          </span>
        }
      />
      <Content pad="tight" gap={22}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 30,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
            }}
          >
            {fixture.value.currency} {fixture.value.amount}
          </span>
          <Meter
            percent={fixture.voyageProgressPct}
            from={fixture.dates.departed}
            to={fixture.dates.arrivalEst}
          />
        </div>

        <Timeline entries={entries} />

        <div
          className="spacer panel"
          style={{
            padding: '16px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 'var(--tap)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              className="mono"
              style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--fg-dim)' }}
            >
              {fixture.fx.movementLabel}
            </span>
            <span style={{ fontSize: 15, color: 'var(--fg)' }}>{fixture.fx.movement}</span>
          </div>
        </div>

        <SecondaryButton onClick={() => navigate('/seller/present')}>
          Message seller
        </SecondaryButton>
      </Content>
    </Screen>
  )
}
