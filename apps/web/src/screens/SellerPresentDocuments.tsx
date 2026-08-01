import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, Screen, SellerBar, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { DocStatus, DocumentRow } from '@/components/Document'
import { UploadRow } from '@/components/UploadRow'
import { Note } from '@/components/Note'
import { ErrorNote } from '@/components/Feedback'
import { api } from '@/api/client'
import { formatBytes } from '@/api/upload'
import { useDeal, useDealFigures } from '@/state/DealContext'

const KIND_LABEL: Record<string, string> = {
  BILL_OF_LADING: 'Bill of lading',
  COMMERCIAL_INVOICE: 'Commercial invoice',
  PACKING_LIST: 'Packing list',
}

/** What this deal expects, in the order a trader assembles them. */
const EXPECTED = [
  { kind: 'BILL_OF_LADING', label: 'Bill of lading', hint: 'REQUIRED FOR RELEASE' },
  { kind: 'COMMERCIAL_INVOICE', label: 'Commercial invoice', hint: 'REQUIRED FOR RELEASE' },
  { kind: 'PACKING_LIST', label: 'Packing list', hint: 'OPTIONAL FOR THIS DEAL' },
] as const

/** 12 — The document layer, in the language of trade. */
export function SellerPresentDocuments() {
  const navigate = useNavigate()
  const deal = useDealFigures()
  const { run, busy, error, preview, refresh } = useDeal()
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const upload = async (kind: string, file: File) => {
    if (preview) return
    setUploading(kind)
    setUploadError(null)
    try {
      await api.uploadDocument(deal.id, file, kind)
      await refresh()
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : 'That document was refused')
    } finally {
      setUploading(null)
    }
  }

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

  const hasBillOfLading = deal.documents.some((d) => d.kind === 'BILL_OF_LADING')

  return (
    <Screen ground="paper" label="Seller — present documents">
      <StatusBar />
      <SellerBar location="DEIRA" />
      <Content gap={22}>
        <Title size={32}>Present your documents</Title>
        <p className="body">
          Release is automatic once these check out against the agreed terms.
        </p>

        {(error || uploadError) && <ErrorNote>{uploadError ?? error!}</ErrorNote>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {EXPECTED.map((slot) => {
            const supplied = deal.documents.find((d) => d.kind === slot.kind)
            if (supplied) {
              return (
                <DocumentRow
                  key={slot.kind}
                  name={KIND_LABEL[supplied.kind] ?? supplied.filename}
                  meta={`${supplied.filename.toUpperCase()} · ${formatBytes(supplied.sizeBytes)}`}
                  state={slot.kind === 'BILL_OF_LADING' ? 'strong' : 'done'}
                  action={<DocStatus>✓ ADDED</DocStatus>}
                />
              )
            }
            return (
              <UploadRow
                key={slot.kind}
                name={slot.label}
                hint={slot.hint}
                busy={uploading === slot.kind}
                onFile={(file) => upload(slot.kind, file)}
              />
            )
          })}
        </div>

        <Note>
          We check consignee, goods description and vessel against the terms{' '}
          {deal.buyerName.split(' ')[0]} agreed. Mismatches come back to you, not to a
          dispute.
        </Note>

        <div className="spacer">
          <PrimaryButton
            onClick={present}
            // The bill of lading is what releases the money on these terms.
            disabled={busy || !hasBillOfLading}
          >
            {busy ? 'Presenting…' : 'Present for verification'}
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
