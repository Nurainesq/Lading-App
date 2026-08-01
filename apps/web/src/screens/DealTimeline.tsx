import { useNavigate } from 'react-router-dom'
import type { DealDto } from '@lading/shared'
import { Content, NavBar, Screen, StatusBar } from '@/components/Screen'
import { SecondaryButton, PrimaryButton } from '@/components/Button'
import { Meter } from '@/components/Progress'
import { Timeline, type TimelineEntry } from '@/components/Timeline'
import { ErrorNote, LoadingNote } from '@/components/Feedback'
import { useDeal, useDealFigures } from '@/state/DealContext'

/** Where each lifecycle stage sits, so the five fixed steps read correctly. */
const ORDER: Record<DealDto['status'], number> = {
  DRAFT: 0,
  AWAITING_ACCEPTANCE: 0,
  AWAITING_FUNDING: 0,
  FUNDED: 1,
  IN_TRANSIT: 2,
  DOCUMENTS_PRESENTED: 3,
  DISCREPANCY: 3,
  RELEASED: 4,
  REFUNDED: 4,
  CANCELLED: 4,
}

function stamp(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toISOString().replace('T', ' · ').slice(0, 16).toUpperCase()
}

function entriesFor(deal: DealDto): TimelineEntry[] {
  const stage = ORDER[deal.status]
  const shipped = deal.timeline.find((t) => t.kind === 'SHIPPED')
  const at = (kind: string) => deal.timeline.find((t) => t.kind === kind)?.occurredAt ?? null

  const state = (index: number): TimelineEntry['state'] =>
    stage > index ? 'done' : stage === index ? 'current' : 'pending'

  return [
    {
      label: 'Escrow funded',
      meta: deal.fundedAt ? stamp(deal.fundedAt) : 'AWAITING BUYER',
      state: deal.fundedAt ? 'done' : state(0),
    },
    {
      label: 'Seller confirmed shipment',
      meta: shipped?.detail ?? (shipped ? stamp(shipped.occurredAt) : 'AWAITING SELLER'),
      state: shipped ? 'done' : state(1),
    },
    {
      label: 'Vessel at sea',
      meta: deal.dayOfWindow
        ? `DAY ${deal.dayOfWindow} OF ${deal.windowDays}`
        : `${deal.windowDays} DAY WINDOW`,
      state: state(2),
    },
    {
      label: 'Bill of lading presented',
      meta: at('DOCUMENTS_PRESENTED') ? stamp(at('DOCUMENTS_PRESENTED')) : 'AWAITING SELLER',
      state: state(3),
    },
    {
      label: 'Funds released',
      meta: deal.releasedAt ? stamp(deal.releasedAt) : 'ON VERIFICATION',
      state: deal.releasedAt ? 'done' : state(4),
    },
  ]
}

/** How the header badge reads for the current status. */
function badgeFor(deal: DealDto): string {
  switch (deal.status) {
    case 'IN_TRANSIT':
      return `IN TRANSIT · DAY ${deal.dayOfWindow ?? 1}/${deal.windowDays}`
    case 'AWAITING_ACCEPTANCE':
      return 'AWAITING ACCEPTANCE'
    case 'AWAITING_FUNDING':
      return 'AWAITING FUNDING'
    case 'DOCUMENTS_PRESENTED':
      return 'DOCUMENTS PRESENTED'
    case 'DISCREPANCY':
      return 'DISCREPANCY OPEN'
    default:
      return deal.status.replace(/_/g, ' ')
  }
}

/**
 * 11 — The 26 days, where trust normally decays. The FX line quietly proves
 * the product's core claim mid-voyage, without anyone having to ask.
 */
export function DealTimeline() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { loading, error, preview } = useDeal()

  const progress = deal.dayOfWindow
    ? Math.round((deal.dayOfWindow / deal.windowDays) * 100)
    : 0

  /** The one action that matters at this point in the lifecycle. */
  const action = (() => {
    if (preview) return null
    switch (deal.status) {
      case 'AWAITING_FUNDING':
        return { label: 'Fund escrow', to: `/deal/${deal.id}/fund` }
      case 'DOCUMENTS_PRESENTED':
        return { label: 'Check the documents', to: `/deal/${deal.id}/verification` }
      case 'FUNDED':
      case 'IN_TRANSIT':
        return { label: 'Present documents', to: `/deal/${deal.id}/present` }
      case 'RELEASED':
        return { label: 'Release certificate', to: `/deal/${deal.id}/certificate` }
      default:
        return null
    }
  })()

  return (
    <Screen label={`Deal ${deal.reference}`}>
      <StatusBar />
      <NavBar
        label={deal.reference}
        onBack={() => navigate('/deals')}
        action={
          <span
            className="mono"
            style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--oxide)' }}
          >
            {badgeFor(deal)}
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
            {deal.value.currency} {deal.value.display}
          </span>
          <Meter
            percent={progress}
            from={deal.route?.split('→')[0]?.trim().toUpperCase() ?? 'ORIGIN'}
            to={deal.route?.split('→')[1]?.trim().toUpperCase() ?? 'DESTINATION'}
          />
        </div>

        {loading && <LoadingNote>LOADING DEAL…</LoadingNote>}
        {error && <ErrorNote>{error}</ErrorNote>}

        {/* The counterparty needs no account, only this link — so the buyer
            has to be able to get at it and send it on. */}
        {deal.inviteUrl && (
          <div className="panel" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span
                className="mono"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--fg-dim)' }}
              >
                SEND THIS TO {deal.sellerName.toUpperCase()}
              </span>
              <span
                className="mono"
                data-testid="invite-url"
                style={{ fontSize: 12, color: 'var(--slate-light)', wordBreak: 'break-all' }}
              >
                {deal.inviteUrl}
              </span>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(deal.inviteUrl!)}
                className="mono"
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  color: 'var(--oxide)',
                  padding: '10px 0',
                }}
              >
                COPY LINK
              </button>
            </div>
          </div>
        )}

        <Timeline entries={entriesFor(deal)} />

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
              FX MOVEMENT SINCE FUNDING
            </span>
            <span style={{ fontSize: 15, color: 'var(--fg)' }}>
              {deal.rateLockedAt
                ? 'Rate held — moves cost you nothing'
                : 'Rate locks when the seller accepts'}
            </span>
          </div>
        </div>

        {action ? (
          <PrimaryButton onClick={() => navigate(action.to)}>{action.label}</PrimaryButton>
        ) : (
          <SecondaryButton>Message seller</SecondaryButton>
        )}
      </Content>
    </Screen>
  )
}
