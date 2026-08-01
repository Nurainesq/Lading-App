import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MoneyDto } from '@lading/shared'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { Actions, GhostButton, PrimaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Note } from '@/components/Note'
import { ErrorNote } from '@/components/Feedback'
import { api } from '@/api/client'
import { useDraft } from '@/state/DraftContext'

interface Quote {
  fee: MoneyDto
  payIn: MoneyDto
  totalDue: MoneyDto
  settlementAmount: MoneyDto
}

/** The design's own figures, for the canvas. */
const PREVIEW_QUOTE: Quote = {
  fee: { currency: 'GHS', minor: 256_200, display: '2,562.00' },
  payIn: { currency: 'GHS', minor: 34_160_000, display: '341,600.00' },
  totalDue: { currency: 'GHS', minor: 34_416_200, display: '344,162.00' },
  settlementAmount: { currency: 'AED', minor: 10_284_400, display: '102,844.00' },
}

/** 06 — Every number the buyer will be held to, before he commits. */
export function NewDealReview({ preview }: { preview?: boolean }) {
  const navigate = useNavigate()
  const { draft, reset } = useDraft()
  const [quote, setQuote] = useState<Quote | null>(preview ? PREVIEW_QUOTE : null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Real figures, from the same conversion the server will use — rather than
  // numbers made up on the client.
  useEffect(() => {
    if (preview) return
    let live = true
    api
      .quote({
        value: draft.value,
        currency: draft.currency,
        fundingCurrency: draft.fundingCurrency,
        settlementCurrency: draft.settlementCurrency,
      })
      .then((result) => live && setQuote(result))
      .catch((cause: unknown) => {
        if (!live) return
        setError(cause instanceof Error ? cause.message : 'Could not price this deal')
      })
    return () => {
      live = false
    }
  }, [draft, preview])

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      const created = await api.createDeal(draft)
      const { deal } = await api.sendDeal(created.id)
      reset()
      navigate(`/deal/${deal.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send this deal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen label="New deal — review">
      <StatusBar />
      <NavBar label="NEW DEAL · 3 OF 3" onBack={() => navigate('/deal/new/terms')} />
      <Content pad="tight" gap={18}>
        <Title size={32}>Review before sending</Title>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Panel>
          <PanelRow label="Seller" value={draft.counterpartyName} />
          <PanelRow
            label="Route"
            value={
              draft.portOfLoading && draft.portOfDischarge
                ? `${draft.portOfLoading} → ${draft.portOfDischarge}`
                : '—'
            }
          />
          <PanelRow label="Goods" value={draft.goods} />
          <PanelRow label="Value" mono value={`${draft.currency} ${draft.value}`} />
          <PanelRow label="Release on" value="Verified B/L" />
        </Panel>

        <Panel>
          <PanelRow
            label="You pay in"
            mono
            value={quote ? `${quote.payIn.currency} ${quote.payIn.display}` : '—'}
          />
          <PanelRow
            label="Escrow fee"
            mono
            value={quote ? `${quote.fee.currency} ${quote.fee.display}` : '—'}
          />
          {/* Honest about when the lock actually happens: at acceptance, not
              here. The design's "THE FULL WINDOW" is what it becomes after. */}
          <PanelRow label="Rate locked" mono tone="oxide" value="ON ACCEPTANCE" />
        </Panel>

        <Note>
          Lading never holds your money. It sits on WeWire's safeguarded infrastructure
          until the condition is met.
        </Note>

        <Actions>
          <PrimaryButton onClick={send} disabled={busy}>
            {busy ? 'Sending…' : 'Send to seller'}
          </PrimaryButton>
          <GhostButton compact onClick={() => navigate('/deals')}>
            Save as draft
          </GhostButton>
        </Actions>
      </Content>
    </Screen>
  )
}
