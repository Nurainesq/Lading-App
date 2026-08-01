import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { GhostButton, PrimaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Stamp } from '@/components/Stamp'
import { useDeal, useDealFigures } from '@/state/DealContext'

/** 10 — The emotional peak for both sides. Stamped, not celebrated. */
export function Funded() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { preview } = useDeal()

  return (
    <Screen label="Escrow funded">
      <StatusBar />
      <Content center pad="roomy" gap={28}>
        <Stamp>FUNDED</Stamp>
        <Title size={40}>
          {deal.value.currency} {deal.value.display.replace('.00', '')} is committed to this
          deal.
        </Title>
        <p className="lede">
          {deal.sellerName} has been notified and can verify it. They cannot draw on it.
          Neither can you.
        </p>
        <Panel>
          <PanelRow roomy label="Reference" mono value={deal.reference} />
          <PanelRow
            roomy
            label="Funded"
            mono
            value={
              deal.fundedAt
                ? new Date(deal.fundedAt)
                    .toISOString()
                    .replace('T', ' · ')
                    .slice(0, 16)
                    .toUpperCase()
                : '—'
            }
          />
          <PanelRow roomy label="Releases on" value="Verified B/L" />
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
        <PrimaryButton onClick={() => !preview && navigate(`/deal/${deal.id}`)}>
          Track this deal
        </PrimaryButton>
        <GhostButton compact>Share proof of funding</GhostButton>
      </div>
    </Screen>
  )
}
