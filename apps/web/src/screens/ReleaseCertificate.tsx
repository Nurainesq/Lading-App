import { useNavigate } from 'react-router-dom'
import { NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { Logo } from '@/components/Logo'
import { Stamp } from '@/components/Stamp'
import { deal as fixture } from '@/data/deal'

const fields = [
  { key: 'BUYER', value: `${fixture.buyer.business} · ${fixture.buyer.city}, ${fixture.buyer.country}` },
  { key: 'SELLER', value: `${fixture.seller.business} · ${fixture.seller.city}, UAE` },
  { key: 'CONSIGNMENT', value: fixture.consignment },
]

/**
 * 16 — The certificate. A document a bank or insurer will accept later, which
 * is why it is set on paper and reproduces the mark in one colour.
 */
export function ReleaseCertificate() {
  const navigate = useNavigate()

  return (
    <Screen ground="paper" label="Release certificate">
      <StatusBar />
      <NavBar
        label=""
        onBack={() => navigate('/deal/released')}
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
                {fixture.dates.certificate}
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
                {fixture.value.currency} {fixture.value.amount}
              </span>
            </div>
            <div className="certificate__field">
              <span className="certificate__key">CONDITION</span>
              <span>
                Bill of lading {fixture.billOfLading}, presented and verified against
                agreed terms.
              </span>
            </div>
          </div>

          <div className="rule" style={{ background: 'var(--paper-line)' }} />

          <p className="certificate__note" style={{ margin: 0 }}>
            Funds were held throughout on WeWire's licensed, safeguarded infrastructure and
            released on satisfaction of the condition above.
          </p>

          <footer className="certificate__foot">
            <Stamp size="sm">RELEASED</Stamp>
            <span className="certificate__verify">
              VERIFY AT
              <br />
              LADING.APP/V/{fixture.reference}
            </span>
          </footer>
        </article>
      </div>
    </Screen>
  )
}
