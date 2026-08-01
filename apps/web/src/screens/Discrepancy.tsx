import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DISCREPANCY_REASONS, type DiscrepancyReason } from '@lading/shared'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { Choice, ChoiceGroup } from '@/components/Choice'
import { Panel } from '@/components/Panel'
import { ErrorNote } from '@/components/Feedback'
import { api } from '@/api/client'
import { useDeal, useDealFigures } from '@/state/DealContext'

const REASON_COPY: Record<DiscrepancyReason, { label: string; detail?: string }> = {
  DOCUMENT_MISMATCH: { label: "Document doesn't match the goods" },
  QUANTITY_SHORT: {
    label: 'Quantity short of the agreed order',
    detail: 'Propose a partial release for what did ship.',
  },
  SUSPECTED_FORGERY: { label: 'Suspected forged document' },
  OTHER: { label: 'Something else' },
}

/**
 * 14 — The unhappy path: the screen that decides whether traders believe you.
 * It leads with the guarantee, not the form.
 */
export function Discrepancy() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { run, busy, error, preview } = useDeal()
  const [reason, setReason] = useState<DiscrepancyReason>('QUANTITY_SHORT')

  const open = () => {
    if (preview) return
    void run(async (id) => {
      const updated = await api.raiseDiscrepancy(id, reason)
      navigate(`/deal/${id}`)
      return updated
    })
  }

  return (
    <Screen label="Raise a discrepancy">
      <StatusBar />
      <NavBar
        label={`DISCREPANCY · ${deal.reference}`}
        onBack={() => navigate(`/deal/${deal.id}/verification`)}
      />
      <Content pad="tightest" gap={16}>
        <Title size={30}>Funds stay put until this is settled</Title>
        <p className="body">
          Nobody can move the money while a discrepancy is open — including us.
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ChoiceGroup label="What is wrong?">
            {DISCREPANCY_REASONS.map((id) => (
              <Choice
                key={id}
                snug
                bright
                title={REASON_COPY[id].label}
                detail={reason === id ? REASON_COPY[id].detail : undefined}
                selected={reason === id}
                onSelect={() => setReason(id)}
              />
            ))}
          </ChoiceGroup>
        </div>

        <Panel>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="field__label">HOW THIS RESOLVES</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
              Both sides get 5 days to agree an amended release. If you don't, the escrow
              agreement's dispute clause decides — and the audit trail of every document
              and timestamp goes with it.
            </p>
          </div>
        </Panel>

        <div className="spacer">
          <PrimaryButton onClick={open} disabled={busy}>
            {busy ? 'Opening…' : 'Open discrepancy'}
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
