import { useNavigate } from 'react-router-dom'
import { NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { Logo } from '@/components/Logo'
import { Stamp } from '@/components/Stamp'
import { useDealFigures } from '@/state/DealContext'

function certificateDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

/**
 * 16 — The certificate. A document a bank or insurer will accept later, which
 * is why it is set on paper and reproduces the mark in one colour.
 */
export function ReleaseCertificate() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const billOfLading = deal.documents.find((d) => d.kind === 'BILL_OF_LADING')

  const fields = [
    { key: 'BUYER', value: deal.buyerName },
    { key: 'SELLER', value: deal.sellerName },
    { key: 'CONSIGNMENT', value: deal.goods },
  ]

  return (
    <Screen ground="paper" label="Release certificate">
      <StatusBar />
      <NavBar
        label=""
        onBack={() => navigate(`/deal/${deal.id}/released`)}
        action={
          <button
            type="button"
            className="mono"
            style={{ fontSize: 13, color: 'var(--slate)', minHeight: 0, padding: 0 }}
          >
            SHARE
          </button>
        }
      />

      <div style={{ flex: 1, padding: '26px 24px', display: 'flex', overflow: 'hidden' }}>
        <article className="certificate">
          <header className="certificate__head">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Title size={22} as="h1">
                Release certificate
              </Title>
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.14em',
                  color: 'var(--on-paper-dim)',
                }}
              >
                {deal.reference} · {certificateDate(deal.releasedAt ?? deal.createdAt)}
              </span>
            </div>
            <Logo size={34} field="ink" oneColour />
          </header>

          <div className="rule" style={{ background: 'var(--paper-line)' }} />

          <div className="certificate__fields">
            {fields.map((field) => (
              <div className="certificate__field" key={field.key}>
                <span className="certificate__key">{field.key}</span>
                <span>{field.value}</span>
              </div>
            ))}
            <div className="certificate__field">
              <span className="certificate__key">VALUE ESCROWED</span>
              <span className="mono" style={{ fontSize: 15 }}>
                {deal.value.currency} {deal.value.display}
              </span>
            </div>
            <div className="certificate__field">
              <span className="certificate__key">CONDITION</span>
              <span>
                Bill of lading {billOfLading?.filename.replace(/\.pdf$/i, '') ?? '—'},
                presented and verified against agreed terms.
              </span>
            </div>
          </div>

          <div className="rule" style={{ background: 'var(--paper-line)' }} />

          <p className="certificate__note" style={{ margin: 0 }}>
            Funds were held throughout on WeWire's licensed, safeguarded infrastructure and
            released on satisfaction of the condition above.
          </p>

          <footer className="certificate__foot">
            {/* Only a settled deal carries the stamp. */}
            <Stamp size="sm">{deal.status === 'RELEASED' ? 'RELEASED' : 'PENDING'}</Stamp>
            <span className="certificate__verify">
              VERIFY AT
              <br />
              LADING.APP/V/{deal.reference}
            </span>
          </footer>
        </article>
      </div>
    </Screen>
  )
}
