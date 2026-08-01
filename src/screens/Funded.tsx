import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { GhostButton, PrimaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Stamp } from '@/components/Stamp'
import { deal as fixture } from '@/data/deal'

/** 10 — The emotional peak for both sides. Stamped, not celebrated. */
export function Funded() {
  const navigate = useNavigate()

  return (
    <Screen label="Escrow funded">
      <StatusBar />
      <Content center pad="roomy" gap={28}>
        <Stamp>FUNDED</Stamp>
        <Title size={40}>USD 28,000 is committed to this deal.</Title>
        <p className="lede">
          {fixture.seller.short} has been notified and can verify it. They cannot draw on
          it. Neither can you.
        </p>
        <Panel>
          <PanelRow roomy label="Reference" mono value={fixture.reference} />
          <PanelRow roomy label="Funded" mono value={fixture.dates.funded} />
          <PanelRow roomy label="Releases on" value={fixture.releaseConditionShort} />
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
        <PrimaryButton onClick={() => navigate('/deal')}>Track this deal</PrimaryButton>
        <GhostButton compact>Share proof of funding</GhostButton>
      </div>
    </Screen>
  )
}
