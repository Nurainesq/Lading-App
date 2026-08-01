import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { Actions, GhostButton, PrimaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Note } from '@/components/Note'
import { deal as fixture } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

/** 06 — Every number the buyer will be held to, before he commits. */
export function NewDealReview() {
  const navigate = useNavigate()
  const deal = useDeal()

  const send = () => {
    deal.set('status', 'awaiting-acceptance')
    navigate('/seller/accept')
  }

  return (
    <Screen label="New deal — review">
      <StatusBar />
      <NavBar label="NEW DEAL · 3 OF 3" onBack={() => navigate('/deal/new/terms')} />
      <Content pad="tight" gap={18}>
        <Title size={32}>Review before sending</Title>

        <Panel>
          <PanelRow label="Seller" value={fixture.seller.short} />
          <PanelRow label="Route" value={fixture.route} />
          <PanelRow label="Goods" value="Spare parts" />
          <PanelRow
            label="Value"
            mono
            value={`${deal.currency} ${deal.value}`}
          />
          <PanelRow label="Release on" value={fixture.releaseConditionShort} />
        </Panel>

        <Panel>
          <PanelRow
            label="You pay in"
            mono
            value={`${fixture.buyerFunds.currency} ${fixture.buyerFunds.amount}`}
          />
          <PanelRow
            label="Escrow fee"
            mono
            value={`${fixture.fee.currency} ${fixture.fee.amount}`}
          />
          <PanelRow label="Rate locked for" mono tone="oxide" value="THE FULL WINDOW" />
        </Panel>

        <Note>
          Lading never holds your money. It sits on WeWire's safeguarded infrastructure
          until the condition is met.
        </Note>

        <Actions>
          <PrimaryButton onClick={send}>Send to seller</PrimaryButton>
          <GhostButton compact onClick={() => navigate('/deals')}>
            Save as draft
          </GhostButton>
        </Actions>
      </Content>
    </Screen>
  )
}
