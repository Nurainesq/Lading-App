import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { DealDto } from '@lading/shared'
import { Content, Screen, SellerBar, StatusBar, Title } from '@/components/Screen'
import { Actions, PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { BoxedNote } from '@/components/Note'
import { ErrorNote } from '@/components/Feedback'
import { Logo } from '@/components/Logo'
import { api } from '@/api/client'
import { previewDeal } from '@/api/preview'

/**
 * 07 — The seller's first screen ever. Paper ground, arrives by link, no
 * account. It has one job: prove he is not being asked to ship on trust.
 *
 * Reached at /invite/:token, and deliberately unauthenticated — the
 * single-use token is the authorisation.
 */
export function SellerAccept({ preview }: { preview?: boolean }) {
  const navigate = useNavigate()
  const { token } = useParams()
  const [deal, setDeal] = useState<DealDto | null>(preview ? previewDeal() : null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const accept = async () => {
    if (!token) return
    setBusy(true)
    setError(null)
    try {
      const accepted = await api.acceptInvite(token)
      setDeal(accepted)
      navigate(`/deal/${accepted.id}/account`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This invitation is not valid')
    } finally {
      setBusy(false)
    }
  }

  const view = deal ?? previewDeal()

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
