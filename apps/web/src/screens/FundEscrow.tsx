import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GHANA_BANKS, GHANA_NETWORKS, type FundDealInput } from '@lading/shared'
import { Content, NavBar, Screen, StatusBar } from '@/components/Screen'
import { Actions, PrimaryButton } from '@/components/Button'
import { Choice, ChoiceGroup } from '@/components/Choice'
import { Panel } from '@/components/Panel'
import { ErrorNote } from '@/components/Feedback'
import { api } from '@/api/client'
import { useDeal, useDealFigures } from '@/state/DealContext'

const SOURCES = [
  {
    id: 'BANK' as const,
    title: 'Bank transfer — GCB',
    meta: 'CLEARS IN UNDER AN HOUR',
  },
  {
    id: 'MOBILE_MONEY' as const,
    title: 'Mobile money — MTN',
    meta: 'DAILY LIMIT MAY APPLY',
  },
]

/**
 * 09 — Funding. The stablecoin layer is explained as FX protection, in the
 * trader's own terms, and never named as crypto.
 */
export function FundEscrow() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { run, busy, error, preview } = useDeal()
  const [source, setSource] = useState<'BANK' | 'MOBILE_MONEY'>('BANK')
  const [account, setAccount] = useState('')

  const fund = () => {
    if (preview) return
    const input: FundDealInput =
      source === 'BANK'
        ? {
            source: 'BANK',
            bankCode: GHANA_BANKS[0],
            accountNumber: account || '1234567890',
          }
        : {
            source: 'MOBILE_MONEY',
            network: GHANA_NETWORKS[0],
            msisdn: account || '0244123456',
          }

    void run(async (id) => {
      const { deal: updated } = await api.fundDeal(id, input)
      // Funding settles asynchronously; the provider webhook is what marks
      // the deal funded, so the buyer lands on the deal rather than on a
      // success screen the system cannot yet stand behind.
      navigate(`/deal/${id}`)
      return updated
    })
  }

  return (
    <Screen label="Fund escrow">
      <StatusBar />
      <NavBar label={`FUND ${deal.reference}`} onBack={() => navigate(`/deal/${deal.id}`)} />
      <Content gap={22}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="field__label">TOTAL DUE</span>
          <span className="amount--display">
            {deal.totalDue
              ? `${deal.totalDue.currency} ${deal.totalDue.display}`
              : `${deal.value.currency} ${deal.value.display}`}
          </span>
          <span className="mono" style={{ fontSize: 13, color: 'var(--fg-dim)' }}>
            {deal.value.currency} {deal.value.display} ESCROWED
            {deal.fee ? ` + ${deal.fee.currency} ${deal.fee.display} FEE` : ''}
          </span>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="field__label">PAY FROM</span>
          <ChoiceGroup label="Funding source">
            {SOURCES.map((option) => (
              <Choice
                key={option.id}
                radio
                title={option.title}
                meta={option.meta}
                selected={source === option.id}
                onSelect={() => setSource(option.id)}
              />
            ))}
          </ChoiceGroup>
          <div className="field__box" data-mono="true">
            <input
              className="field__input"
              value={account}
              onChange={(e) => setAccount(e.target.value.replace(/\D/g, ''))}
              aria-label={source === 'BANK' ? 'Bank account number' : 'Mobile money number'}
              placeholder={source === 'BANK' ? 'Account number' : '0244123456'}
              inputMode="numeric"
            />
          </div>
        </div>

        <Panel>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="field__label">WHAT HAPPENS TO YOUR CEDIS</span>
            <div className="fxline">
              <span>{deal.totalDue?.currency ?? 'GHS'}</span>
              <span className="fxline__rule" />
              <span className="oxide">HELD STABLE</span>
              <span className="fxline__rule" />
              <span>{deal.settlementAmount?.currency ?? 'AED'}</span>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-muted)' }}>
              Your rate is fixed today. If the cedi moves over the next {deal.windowDays}{' '}
              days, it costs neither of you anything.
            </p>
          </div>
        </Panel>

        <Actions>
          <PrimaryButton onClick={fund} disabled={busy}>
            {busy ? 'Funding…' : 'Confirm and fund'}
          </PrimaryButton>
          <p className="legal" style={{ margin: 0 }}>
            FUNDS GO TO THE ESCROW ACCOUNT, NOT TO THE SELLER
          </p>
        </Actions>
      </Content>
    </Screen>
  )
}
