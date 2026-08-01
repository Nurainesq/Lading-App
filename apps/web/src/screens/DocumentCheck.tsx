import { useNavigate } from 'react-router-dom'
import { DOCUMENT_CHECKS, type DocumentCheckName } from '@lading/shared'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { Actions, PrimaryButton, SecondaryButton } from '@/components/Button'
import { Panel, PanelRow } from '@/components/Panel'
import { Note } from '@/components/Note'
import { ErrorNote } from '@/components/Feedback'
import { api } from '@/api/client'
import { useDeal, useDealFigures } from '@/state/DealContext'

const CHECK_LABEL: Record<DocumentCheckName, string> = {
  CONSIGNEE: 'Consignee',
  GOODS_DESCRIPTION: 'Goods description',
  VESSEL_AND_VOYAGE: 'Vessel & voyage',
  PORT_OF_DISCHARGE: 'Port of discharge',
  SHIPPED_ON_BOARD_DATE: 'Shipped on board date',
}

/** 13 — Verification: five named checks, and a dispute path that isn't hidden. */
export function DocumentCheck() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { run, busy, error, preview } = useDeal()

  const resultOf = (name: DocumentCheckName) =>
    deal.checks.find((c) => c.name === name)?.result ?? null

  // Release only runs automatically when every check matched. A single
  // non-match holds the money, which is what the copy below has to say.
  const allMatch =
    deal.checks.length === DOCUMENT_CHECKS.length &&
    DOCUMENT_CHECKS.every((name) => resultOf(name) === 'MATCH')

  const billOfLading = deal.documents.find((d) => d.kind === 'BILL_OF_LADING')

  const release = () => {
    if (preview) return
    void run(async (id) => {
      const updated = await api.releaseDeal(id)
      navigate(`/deal/${id}/released`)
      return updated
    })
  }

  return (
    <Screen label="Document check">
      <StatusBar />
      <NavBar
        label={`DOCUMENT CHECK · ${deal.reference}`}
        onBack={() => navigate(`/deal/${deal.id}`)}
      />
      <Content pad="tight" gap={22}>
        <Title size={30}>Bill of lading checked against your terms</Title>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Panel>
          {DOCUMENT_CHECKS.map((name) => {
            const result = resultOf(name)
            return (
              <PanelRow
                key={name}
                labelMuted
                label={CHECK_LABEL[name]}
                value={
                  <span
                    className="mono"
                    style={{
                      fontSize: 13,
                      // Only a match earns oxide; a pending or failed check
                      // must not read as a condition met.
                      color: result === 'MATCH' ? 'var(--oxide)' : 'var(--fg-dim)',
                    }}
                  >
                    {result ?? 'PENDING'}
                  </span>
                }
              />
            )
          })}
        </Panel>

        <Panel>
          <PanelRow
            label={<span style={{ color: 'var(--fg)' }}>View the document</span>}
            value={
              <span className="mono" style={{ fontSize: 12, color: 'var(--slate-light)' }}>
                {billOfLading?.filename.replace(/\.pdf$/i, '') ?? '—'}
              </span>
            }
          />
        </Panel>

        <Note tone={allMatch ? 'oxide' : 'slate'}>
          {allMatch
            ? 'All five conditions are met. You have 24 hours to raise a discrepancy before release runs automatically.'
            : 'Not every condition has been met yet. Nothing is released while a check is outstanding.'}
        </Note>

        <Actions>
          <PrimaryButton onClick={release} disabled={busy || !allMatch}>
            {busy ? 'Releasing…' : 'Release now'}
          </PrimaryButton>
          <SecondaryButton
            muted
            onClick={() => navigate(`/deal/${deal.id}/discrepancy`)}
          >
            Raise a discrepancy
          </SecondaryButton>
        </Actions>
      </Content>
    </Screen>
  )
}
