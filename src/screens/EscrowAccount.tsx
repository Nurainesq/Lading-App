import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { Panel, PanelField, Rule } from '@/components/Panel'
import { deal as fixture } from '@/data/deal'

const guarantees = [
  'Segregated from every other deal',
  'Reconciles automatically on funding',
  'Closes when the deal settles',
]

/** 08 — The virtual account shown as an instrument: the escrow made tangible. */
export function EscrowAccount() {
  const navigate = useNavigate()

  return (
    <Screen label="Escrow account issued">
      <StatusBar />
      <Content pad="roomy" gap={26}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span
            className="mono"
            style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--oxide)' }}
          >
            SELLER ACCEPTED · {fixture.dates.accepted}
          </span>
          <Title size={36}>Escrow account issued for this deal</Title>
          <p className="body">
            One account, {fixture.reference} only. Nothing else is ever paid into it.
          </p>
        </div>

        <Panel>
          <div className="panel__body">
            <PanelField label="ACCOUNT NAME">
              <span style={{ fontSize: 17, color: 'var(--fg)' }}>
                {fixture.escrowAccount.name}
              </span>
            </PanelField>
            <Rule />
            <PanelField label="ACCOUNT NUMBER">
              <span
                className="mono"
                style={{ fontSize: 22, letterSpacing: '0.08em', color: 'var(--fg)' }}
              >
                {fixture.escrowAccount.number}
              </span>
            </PanelField>
            <Rule />
            <PanelField label="HELD BY">
              <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--fg-muted)' }}>
                {fixture.escrowAccount.heldBy}
              </span>
            </PanelField>
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {guarantees.map((line) => (
            <div className="checkitem" key={line}>
              <span className="checkitem__mark" aria-hidden="true" />
              {line}
            </div>
          ))}
        </div>

        <div className="spacer">
          <PrimaryButton onClick={() => navigate('/deal/fund')}>
            Fund escrow — GHS 344,162
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
