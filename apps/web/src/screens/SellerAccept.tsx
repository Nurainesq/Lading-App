import { useState } from 'react'
import { useParams } from 'react-router-dom'
import type { DealDto } from '@lading/shared'
import { Content, Screen, SellerBar, StatusBar, Title } from '@/components/Screen'
import { Actions, PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { BoxedNote } from '@/components/Note'
import { ErrorNote } from '@/components/Feedback'
import { Logo } from '@/components/Logo'
import { Stamp } from '@/components/Stamp'
import { api } from '@/api/client'
import { previewDeal } from '@/api/preview'

/**
 * 07 — The seller's first screen ever. Paper ground, arrives by link, no
 * account. It has one job: prove he is not being asked to ship on trust.
 *
 * Reached at /invite/:token and deliberately unauthenticated — the single-use
 * token is the authorisation. Which is also why accepting does not hand the
 * seller on to any other screen: he has no session, so every authenticated
 * route would fail. Everything he needs is in the accept response.
 */
export function SellerAccept({ preview }: { preview?: boolean }) {
  const { token } = useParams()
  const [deal, setDeal] = useState<DealDto | null>(preview ? previewDeal() : null)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      setDeal(await api.acceptInvite(token))
      setAccepted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This invitation is not valid')
    } finally {
      setBusy(false)
    }
  }

  const view = deal ?? previewDeal()

  if (accepted && deal) {
    return (
      <Screen ground="paper" label="Seller — terms accepted">
        <StatusBar />
        <SellerBar location="DEIRA" />
        <Content center gap={24}>
          <Stamp>ACCEPTED</Stamp>
          <Title size={32}>
            You'll be paid {deal.settlementAmount?.currency}{' '}
            {deal.settlementAmount?.display.replace('.00', '')} on a verified bill of
            lading.
          </Title>
          <p className="body">
            {deal.buyerName} funds the escrow next. You'll get a message the moment the
            money is committed — do not ship before then.
          </p>
          <Panel>
            <PanelRow label="Reference" mono value={deal.reference} />
            <PanelRow label="Goods" value={deal.goods} />
            <PanelRow label="Released on" value="Verified B/L" />
          </Panel>
          <BoxedNote label="WHAT HAPPENS NOW">
            Nothing is owed by you yet. When the buyer funds, the money is locked to this
            deal — he cannot withdraw it and you cannot be paid less.
          </BoxedNote>
        </Content>
      </Screen>
    )
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

        <Title size={32}>{view.buyerName} has proposed an escrowed deal</Title>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Panel>
          <PanelRow label="Buyer" value={view.buyerName} />
          <PanelRow
            label="You receive"
            mono
            value={
              view.settlementAmount
                ? `${view.settlementAmount.currency} ${view.settlementAmount.display}`
                : 'On acceptance'
            }
          />
          <PanelRow label="Released on" value="Verified B/L" />
        </Panel>

        <BoxedNote label="WHAT THIS MEANS FOR YOU">
          You do not ship on trust. Once he funds, you'll see the money committed and
          locked to this deal — you cannot be paid less, and he cannot withdraw it.
        </BoxedNote>

        <Actions>
          <PrimaryButton onClick={accept} disabled={busy || !token}>
            {busy ? 'Accepting…' : 'Accept terms'}
          </PrimaryButton>
          <SecondaryButton muted>Propose a change</SecondaryButton>
        </Actions>
      </Content>
    </Screen>
  )
}
