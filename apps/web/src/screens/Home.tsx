import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DealDto } from '@lading/shared'
import { AppBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { ErrorNote, LoadingNote } from '@/components/Feedback'
import { TabBar } from '@/components/TabBar'
import { api } from '@/api/client'
import { previewDeals } from '@/api/preview'

/**
 * 03 / 17 — Home, empty and populated.
 *
 * Empty answers the first objection a trader has: does my supplier need this
 * app? Populated puts the trade record — the thing banks price against — at
 * the top of the screen from the first settled deal.
 */

/** How a deal's status reads on the list, and in which tone. */
function statusOf(deal: DealDto): { label: string; tone: 'oxide' | 'slate' | 'dim' } {
  switch (deal.status) {
    case 'RELEASED':
      return { label: 'RELEASED', tone: 'oxide' }
    case 'REFUNDED':
      return { label: 'REFUNDED', tone: 'oxide' }
    case 'IN_TRANSIT':
      return { label: 'IN TRANSIT', tone: 'slate' }
    case 'DOCUMENTS_PRESENTED':
      return { label: 'DOCUMENTS IN', tone: 'slate' }
    case 'DISCREPANCY':
      return { label: 'DISCREPANCY', tone: 'oxide' }
    case 'FUNDED':
      return { label: 'FUNDED', tone: 'slate' }
    case 'AWAITING_FUNDING':
      return { label: 'AWAITING FUNDING', tone: 'dim' }
    case 'AWAITING_ACCEPTANCE':
      return { label: 'AWAITING ACCEPTANCE', tone: 'dim' }
    case 'CANCELLED':
      return { label: 'CANCELLED', tone: 'dim' }
    default:
      return { label: 'DRAFT', tone: 'dim' }
  }
}

/** "Escrowed to date" counts only what actually settled. */
function tradeRecordOf(deals: DealDto[]) {
  const settled = deals.filter((d) => d.status === 'RELEASED')
  const currency = settled[0]?.value.currency ?? 'USD'
  const sameCurrency = settled.every((d) => d.value.currency === currency)
  const totalMinor = settled.reduce((sum, d) => sum + d.value.minor, 0)
  const grouped = (totalMinor / 100)
    .toFixed(0)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return {
    settledCount: settled.length,
    // Nothing settled is not "USD 0" — there is no record yet to state. And
    // mixing currencies into one total would be a lie, so say nothing there
    // either; both render as an em dash.
    escrowedToDate:
      settled.length === 0 ? null : sameCurrency ? `${currency} ${grouped}` : null,
  }
}

export function Home({ preview }: { preview?: 'empty' | 'populated' }) {
  const navigate = useNavigate()
  const [deals, setDeals] = useState<DealDto[] | null>(
    preview === 'empty' ? [] : preview === 'populated' ? previewDeals() : null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // The canvas renders this screen twice; neither should hit the network.
    if (preview) return
    let live = true
    api
      .listDeals()
      .then(({ deals: loaded }) => live && setDeals(loaded))
      .catch((cause: unknown) => {
        if (!live) return
        setError(cause instanceof Error ? cause.message : 'Could not load your deals')
        setDeals([])
      })
    return () => {
      live = false
    }
  }, [preview])

  const record = deals ? tradeRecordOf(deals) : null

  // Empty state, which is also what a failed load falls back to — with the
  // error stated rather than silently reading as "no deals".
  if (deals !== null && deals.length === 0) {
    return (
      <Screen label="Deals">
        <StatusBar />
        <AppBar
          action={
            <span
              className="mono"
              style={{ fontSize: 12, letterSpacing: '0.12em', color: 'var(--oxide)' }}
            >
              VERIFIED
            </span>
          }
        />

        <div className="empty">
          <div className="empty__glyph" aria-hidden="true">
            <div className="empty__glyph-inner">
              <div className="empty__glyph-bar" />
              <div className="empty__glyph-bar" style={{ width: '70%' }} />
              <div className="empty__glyph-bar" />
            </div>
          </div>
          <Title size={28}>No deals yet</Title>
          <p className="body empty__body">
            Start one and we'll issue an escrow account for it. Your counterparty doesn't
            need an account to be invited.
          </p>
          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <div style={{ padding: '0 24px 20px' }}>
          <PrimaryButton onClick={() => navigate('/deal/new/counterparty')}>
            Start a deal
          </PrimaryButton>
        </div>
        <TabBar active="deals" />
      </Screen>
    )
  }

  return (
    <Screen label="Deals">
      <StatusBar />
      <AppBar
        action={
          <button
            type="button"
            aria-label="Start a deal"
            style={{ fontSize: 20, color: 'var(--fg)', minHeight: 0, padding: 0 }}
            onClick={() => navigate('/deal/new/counterparty')}
          >
            ＋
          </button>
        }
      />

      <div
        style={{
          padding: '22px 24px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 'none',
        }}
      >
        <span
          className="mono"
          style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--fg-dim)' }}
        >
          {record
            ? `TRADE RECORD · ${record.settledCount} DEAL${record.settledCount === 1 ? '' : 'S'} SETTLED`
            : 'TRADE RECORD'}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 34,
              letterSpacing: '-0.02em',
              color: 'var(--fg)',
            }}
          >
            {record?.escrowedToDate ?? '—'}
          </span>
          <span style={{ fontSize: 14, color: 'var(--fg-muted)' }}>escrowed to date</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
          This history is what banks and insurers will price against later.
        </p>
      </div>

      <div className="deallist">
        {deals === null && (
          <div style={{ padding: '20px 24px' }}>
            <LoadingNote>LOADING DEALS…</LoadingNote>
          </div>
        )}
        {error && (
          <div style={{ padding: '20px 24px' }}>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        {deals?.map((deal) => {
          const status = statusOf(deal)
          return (
            <button
              key={deal.id}
              type="button"
              className="deallist__item"
              onClick={() => navigate(`/deal/${deal.id}`)}
            >
              <span className="deallist__head">
                <span className="deallist__name">{deal.sellerName}</span>
                <span className="deallist__status" data-tone={status.tone}>
                  {status.label}
                </span>
              </span>
              <span className="deallist__foot">
                <span className="deallist__ref">
                  {deal.reference}
                  {deal.route ? ` · ${deal.route.toUpperCase()}` : ''}
                </span>
                <span className="deallist__value">
                  {deal.value.currency} {deal.value.display.replace('.00', '')}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <TabBar active="deals" />
    </Screen>
  )
}
