import { useNavigate } from 'react-router-dom'
import { Content, Screen, SellerBar, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { DocAction, DocStatus, DocumentRow } from '@/components/Document'
import { Note } from '@/components/Note'
import { ErrorNote } from '@/components/Feedback'
import { api } from '@/api/client'
import { useDeal, useDealFigures } from '@/state/DealContext'

const KIND_LABEL: Record<string, string> = {
  BILL_OF_LADING: 'Bill of lading',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  PACKING_LIST: 'Packing list',
}

function sizeOf(bytes: number): string {
  return bytes >= 1_000_000
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`
}

/** 12 — The document layer, in the language of trade. */
export function SellerPresentDocuments() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { run, busy, error, preview } = useDeal()

  const present = () => {
    if (preview || deal.documents.length === 0) return
    void run(async (id) => {
      const updated = await api.presentDocuments(
        id,
        deal.documents.map((d) => d.id),
      )
      navigate(`/deal/${id}/verification`)
      return updated
    })
  }

  const hasPackingList = deal.documents.some((d) => d.kind === 'PACKING_LIST')

  return (
    <Screen ground="paper" label="Seller — present documents">
      <StatusBar />
      <SellerBar location="DEIRA" />
      <Content gap={22}>
        <Title size={32}>Present your documents</Title>
        <p className="body">
          Release is automatic once these check out against the agreed terms.
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {deal.documents.map((document, index) => (
            <DocumentRow
              key={document.id}
              name={KIND_LABEL[document.kind] ?? document.filename}
              meta={`${document.filename} · ${sizeOf(document.sizeBytes)}`}
              state={index === 0 ? 'strong' : 'done'}
              action={<DocStatus>✓ ADDED</DocStatus>}
            />
          ))}

          {!hasPackingList && (
            <DocumentRow
              name="Packing list"
              meta="OPTIONAL FOR THIS DEAL"
              state="empty"
              roomy
              action={<DocAction>ADD</DocAction>}
            />
          )}
        </div>

        <Note>
          We check consignee, goods description and vessel against the terms{' '}
          {deal.buyerName.split(' ')[0]} agreed. Mismatches come back to you, not to a
          dispute.
        </Note>

        <div className="spacer">
          <PrimaryButton onClick={present} disabled={busy || deal.documents.length === 0}>
            {busy ? 'Presenting…' : 'Present for verification'}
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
