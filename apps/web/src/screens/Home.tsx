import { useNavigate } from 'react-router-dom'
import { AppBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { TabBar } from '@/components/TabBar'
import { tradeRecord } from '@/data/deal'

/**
 * 03 / 17 — Home, empty and populated.
 *
 * Empty answers the first objection a trader has: does my supplier need this
 * app? Populated puts the trade record — the thing banks price against — at
 * the top of the screen from the first settled deal.
 */
export function Home({ populated = false }: { populated?: boolean }) {
  const navigate = useNavigate()

  if (!populated) {
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
          TRADE RECORD · {tradeRecord.settledCount} DEALS SETTLED
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
            {tradeRecord.escrowedToDate}
          </span>
          <span style={{ fontSize: 14, color: 'var(--fg-muted)' }}>escrowed to date</span>
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
          This history is what banks and insurers will price against later.
        </p>
      </div>

      <div className="deallist">
        {tradeRecord.deals.map((entry) => (
          <button
            key={entry.reference}
            type="button"
            className="deallist__item"
            onClick={() => navigate('/deal')}
          >
            <span className="deallist__head">
              <span className="deallist__name">{entry.counterparty}</span>
              <span className="deallist__status" data-tone={entry.tone}>
                {entry.status}
              </span>
            </span>
            <span className="deallist__foot">
              <span className="deallist__ref">{entry.reference}</span>
              <span className="deallist__value">{entry.value}</span>
            </span>
          </button>
        ))}
      </div>

      <TabBar active="deals" />
    </Screen>
  )
}
