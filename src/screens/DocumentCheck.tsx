import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { Actions, PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Note } from '@/components/Note'
import { deal as fixture, documentChecks } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

/** 13 — Verification: five named checks, and a dispute path that isn't hidden. */
export function DocumentCheck() {
  const navigate = useNavigate()
  const deal = useDeal()

  const release = () => {
    deal.set('status', 'released')
    deal.set('hasHistory', true)
    navigate('/deal/released')
  }

  return (
    <Screen label="Document check">
      <StatusBar />
      <NavBar
        label={`DOCUMENT CHECK · ${fixture.reference}`}
        onBack={() => navigate('/deal')}
      />
      <Content pad="tight" gap={22}>
        <Title size={30}>Bill of lading checked against your terms</Title>

        <Panel>
          {documentChecks.map((check) => (
            <PanelRow
              key={check}
              labelMuted
              label={check}
              value={
                <span className="mono" style={{ fontSize: 13, color: 'var(--oxide)' }}>
                  MATCH
                </span>
              }
            />
          ))}
        </Panel>

        <Panel>
          <PanelRow
            label={<span style={{ color: 'var(--fg)' }}>View the document</span>}
            value={
              <span
                className="mono"
                style={{ fontSize: 12, color: 'var(--slate-light)' }}
              >
                {fixture.billOfLading}
              </span>
            }
          />
        </Panel>

        <Note tone="oxide">
          All five conditions are met. You have 24 hours to raise a discrepancy before
          release runs automatically.
        </Note>

        <Actions>
          <PrimaryButton onClick={release}>Release now</PrimaryButton>
          <SecondaryButton muted onClick={() => navigate('/deal/discrepancy')}>
            Raise a discrepancy
          </SecondaryButton>
        </Actions>
      </Content>
    </Screen>
  )
}
