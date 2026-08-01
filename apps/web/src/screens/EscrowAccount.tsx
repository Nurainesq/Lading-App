import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { Panel, PanelField, Rule } from '@/components/Panel'
import { useDeal, useDealFigures } from '@/state/DealContext'

const guarantees = [
  'Segregated from every other deal',
  'Reconciles automatically on funding',
  'Closes when the deal settles',
]

/** 08 — The virtual account shown as an instrument: the escrow made tangible. */
export function EscrowAccount() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { preview } = useDeal()
  const account = deal.escrowAccount

  const acceptedAt = deal.timeline.find((t) => t.kind === 'ACCEPTED')?.occurredAt

  return (
    <Screen label="Escrow account issued">
      <StatusBar />
      <Content pad="roomy" gap={26}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span
            className="mono"
            style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--oxide)' }}
          >
            SELLER ACCEPTED
            {acceptedAt
              ? ` · ${new Date(acceptedAt).toISOString().slice(11, 16)} GMT`
              : ''}
          </span>
          <Title size={36}>Escrow account issued for this deal</Title>
          <p className="body">
            One account, {deal.reference} only. Nothing else is ever paid into it.
          </p>
        </div>

        <Panel>
          <div className="panel__body">
            <PanelField label="ACCOUNT NAME">
              <span style={{ fontSize: 17, color: 'var(--fg)' }}>
                {account?.accountName ?? `LADING ESCROW / ${deal.reference}`}
              </span>
            </PanelField>
            <Rule />
            <PanelField label="ACCOUNT NUMBER">
              <span
                className="mono"
                style={{ fontSize: 22, letterSpacing: '0.08em', color: 'var(--fg)' }}
              >
                {account?.accountNumber ?? 'Being issued…'}
              </span>
            </PanelField>
            <Rule />
            <PanelField label="HELD BY">
              <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--fg-muted)' }}>
                {account?.heldBy ??
                  'WeWire — licensed, safeguarded. Lading has release rights only, never custody.'}
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
          <PrimaryButton
            onClick={() => !preview && navigate(`/deal/${deal.id}/fund`)}
          >
            {deal.totalDue
              ? `Fund escrow — ${deal.totalDue.currency} ${deal.totalDue.display.replace('.00', '')}`
              : 'Fund escrow'}
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
