import { useNavigate } from 'react-router-dom'
import { Content, Screen, SellerBar, StatusBar, Title } from '@/components/Screen'
import { Actions, PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { BoxedNote } from '@/components/Note'
import { Logo } from '@/components/Logo'
import { deal as fixture } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

/**
 * 07 — The seller's first screen ever. Paper ground, arrives by link, no
 * account. It has one job: prove he is not being asked to ship on trust.
 */
export function SellerAccept() {
  const navigate = useNavigate()
  const deal = useDeal()

  const accept = () => {
    deal.set('status', 'awaiting-funding')
    navigate('/deal/account')
  }

  return (
    <Screen ground="paper" label="Seller — accept terms">
      <StatusBar />
      <SellerBar location="DEIRA" />
      <Content gap={22}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo field="ink" />
          <span className="appbar__wordmark">Lading</span>
        </div>

        <Title size={32}>{fixture.buyer.contact} has proposed an escrowed deal</Title>

        <Panel>
          <PanelRow label="Buyer" value={fixture.buyer.short} />
          <PanelRow
            label="You receive"
            mono
            value={`${fixture.sellerReceives.currency} ${fixture.sellerReceives.amount}`}
          />
          <PanelRow label="Released on" value={fixture.releaseConditionShort} />
        </Panel>

        <BoxedNote label="WHAT THIS MEANS FOR YOU">
          You do not ship on trust. Once he funds, you'll see the money committed and
          locked to this deal — you cannot be paid less, and he cannot withdraw it.
        </BoxedNote>

        <Actions>
          <PrimaryButton onClick={accept}>Accept terms</PrimaryButton>
          <SecondaryButton muted onClick={() => navigate('/deal/new/terms')}>
            Propose a change
          </SecondaryButton>
        </Actions>
      </Content>
    </Screen>
  )
}
