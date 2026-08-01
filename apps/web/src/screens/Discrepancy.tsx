import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { Choice, ChoiceGroup } from '@/components/Choice'
import { Panel } from '@/components/Panel'
import { deal as fixture, discrepancyReasons } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

/**
 * 14 — The unhappy path: the screen that decides whether traders believe you.
 * It leads with the guarantee, not the form.
 */
export function Discrepancy() {
  const navigate = useNavigate()
  const deal = useDeal()

  const open = () => {
    deal.set('status', 'discrepancy')
    navigate('/deal')
  }

  return (
    <Screen label="Raise a discrepancy">
      <StatusBar />
      <NavBar
        label={`DISCREPANCY · ${fixture.reference}`}
        onBack={() => navigate('/deal/verification')}
      />
      <Content pad="tightest" gap={16}>
        <Title size={30}>Funds stay put until this is settled</Title>
        <p className="body">
          Nobody can move the money while a discrepancy is open — including us.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ChoiceGroup label="What is wrong?">
            {discrepancyReasons.map((reason) => (
              <Choice
                key={reason.id}
                snug
                bright
                title={reason.label}
                detail={
                  deal.discrepancyReason === reason.id && 'detail' in reason
                    ? reason.detail
                    : undefined
                }
                selected={deal.discrepancyReason === reason.id}
                onSelect={() => deal.set('discrepancyReason', reason.id)}
              />
            ))}
          </ChoiceGroup>
        </div>

        <Panel>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="field__label">HOW THIS RESOLVES</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
              Both sides get 5 days to agree an amended release. If you don't, the escrow
              agreement's dispute clause decides — and the audit trail of every document
              and timestamp goes with it.
            </p>
          </div>
        </Panel>

        <div className="spacer">
          <PrimaryButton onClick={open}>Open discrepancy</PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
