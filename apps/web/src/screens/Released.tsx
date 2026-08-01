import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Stamp } from '@/components/Stamp'
import { deal as fixture } from '@/data/deal'

/** 15 — Release, and immediately the repeat-deal prompt, where retention lives. */
export function Released() {
  const navigate = useNavigate()

  return (
    <Screen label="Funds released">
      <StatusBar />
      <Content center pad="roomy" gap={26}>
        <Stamp>RELEASED</Stamp>
        <Title size={38}>
          Al Habib has been paid {fixture.sellerReceives.currency}{' '}
          {fixture.sellerReceives.amount.replace('.00', '')}.
        </Title>
        <p className="lede">
          Settled {fixture.dates.settlement}. No correspondent chain, no banking hours.
        </p>
        <Panel>
          <PanelRow roomy label="Deal" mono value={fixture.reference} />
          <PanelRow roomy label="Window" mono value={`${fixture.windowDays} DAYS`} />
          <PanelRow roomy label="FX carried by either side" mono tone="oxide" value="NONE" />
          <PanelRow roomy label="Escrow account" mono value="CLOSED" />
        </Panel>
      </Content>

      <div
        style={{
          padding: '0 28px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          flex: 'none',
        }}
      >
        <PrimaryButton onClick={() => navigate('/deal/certificate')}>
          Download release certificate
        </PrimaryButton>
        <SecondaryButton onClick={() => navigate('/deal/new/counterparty')}>
          Start another deal with this seller
        </SecondaryButton>
      </div>
    </Screen>
  )
}
