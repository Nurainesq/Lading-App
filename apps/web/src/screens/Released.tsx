import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Stamp } from '@/components/Stamp'
import { useDeal, useDealFigures } from '@/state/DealContext'

/** 15 — Release, and immediately the repeat-deal prompt, where retention lives. */
export function Released() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { preview } = useDeal()

  /** How long the release took once the documents checked out. */
  const settlement = (() => {
    const presented = deal.timeline.find((t) => t.kind === 'DOCUMENTS_PRESENTED')
    if (!presented || !deal.releasedAt) return null
    const minutes = Math.round(
      (new Date(deal.releasedAt).getTime() - new Date(presented.occurredAt).getTime()) /
        60_000,
    )
    if (minutes < 1) return 'in under a minute'
    if (minutes < 90) return `${minutes} minutes`
    return `${Math.round(minutes / 60)} hours`
  })()

  return (
    <Screen label="Funds released">
      <StatusBar />
      <Content center pad="roomy" gap={26}>
        <Stamp>RELEASED</Stamp>
        <Title size={38}>
          {deal.sellerName.split(' ')[0]} has been paid{' '}
          {deal.settlementAmount
            ? `${deal.settlementAmount.currency} ${deal.settlementAmount.display.replace('.00', '')}`
            : ''}
          .
        </Title>
        <p className="lede">
          {settlement
            ? `Settled ${settlement} after the bill of lading was verified.`
            : 'Settled once the bill of lading was verified.'}{' '}
          No correspondent chain, no banking hours.
        </p>
        <Panel>
          <PanelRow roomy label="Deal" mono value={deal.reference} />
          <PanelRow roomy label="Window" mono value={`${deal.windowDays} DAYS`} />
          <PanelRow roomy label="FX carried by either side" mono tone="oxide" value="NONE" />
          <PanelRow
            roomy
            label="Escrow account"
            mono
            value={deal.escrowAccount?.status ?? 'CLOSED'}
          />
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
        <PrimaryButton onClick={() => !preview && navigate(`/deal/${deal.id}/certificate`)}>
          Download release certificate
        </PrimaryButton>
        <SecondaryButton onClick={() => !preview && navigate('/deal/new/counterparty')}>
          Start another deal with this seller
        </SecondaryButton>
      </div>
    </Screen>
  )
}
