import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar } from '@/components/Screen'
import { Actions, PrimaryButton } from '@/components/Button'
import { Choice, ChoiceGroup } from '@/components/Choice'
import { Panel } from '@/components/Panel'
import { deal as fixture } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

const sources = [
  { id: 'bank', title: 'Bank transfer — GCB', meta: 'CLEARS IN UNDER AN HOUR' },
  { id: 'momo', title: 'Mobile money — MTN', meta: 'DAILY LIMIT MAY APPLY' },
] as const

/**
 * 09 — Funding. The stablecoin layer is explained as FX protection, in the
 * trader's own terms, and never named as crypto.
 */
export function FundEscrow() {
  const navigate = useNavigate()
  const deal = useDeal()

  const fund = () => {
    deal.set('status', 'funded')
    navigate('/deal/funded')
  }

  return (
    <Screen label="Fund escrow">
      <StatusBar />
      <NavBar label={`FUND ${fixture.reference}`} onBack={() => navigate('/deal/account')} />
      <Content gap={22}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="field__label">TOTAL DUE</span>
          <span className="amount--display">
            {fixture.totalDue.currency} {fixture.totalDue.amount}
          </span>
          <span className="mono" style={{ fontSize: 13, color: 'var(--fg-dim)' }}>
            USD 28,000.00 ESCROWED + GHS 2,562.00 FEE
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="field__label">PAY FROM</span>
          <ChoiceGroup label="Funding source">
            {sources.map((source) => (
              <Choice
                key={source.id}
                radio
                title={source.title}
                meta={source.meta}
                selected={deal.fundingSource === source.id}
                onSelect={() => deal.set('fundingSource', source.id)}
              />
            ))}
          </ChoiceGroup>
        </div>

        <Panel>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="field__label">WHAT HAPPENS TO YOUR CEDIS</span>
            <div className="fxline">
              <span>GHS</span>
              <span className="fxline__rule" />
              <span className="oxide">HELD STABLE</span>
              <span className="fxline__rule" />
              <span>AED</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
              Your rate is fixed today. If the cedi moves over the next{' '}
              {fixture.windowDays} days, it costs neither of you anything.
            </p>
          </div>
        </Panel>

        <Actions>
          <PrimaryButton onClick={fund}>Confirm and fund</PrimaryButton>
          <p className="legal" style={{ margin: 0 }}>
            FUNDS GO TO THE ESCROW ACCOUNT, NOT TO THE SELLER
          </p>
        </Actions>
      </Content>
    </Screen>
  )
}
