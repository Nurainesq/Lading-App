import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, Screen, SellerBar, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { DocAction, DocStatus, DocumentRow } from '@/components/Document'
import { Note } from '@/components/Note'
import { deal as fixture } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

/** 12 — The document layer, in the language of trade. */
export function SellerPresentDocuments() {
  const navigate = useNavigate()
  const deal = useDeal()
  const [packingList, setPackingList] = useState(false)

  const present = () => {
    deal.set('status', 'documents-presented')
    navigate('/deal/verification')
  }

  return (
    <Screen ground="paper" label="Seller — present documents">
      <StatusBar />
      <SellerBar location="DEIRA" />
      <Content gap={22}>
        <Title size={32}>Present your documents</Title>
        <p className="body">
          Release is automatic once these check out against the agreed terms.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DocumentRow
            name="Bill of lading"
            meta={`${fixture.billOfLading}.PDF · 1.2 MB`}
            state="strong"
            action={<DocStatus>✓ ADDED</DocStatus>}
          />
          <DocumentRow
            name="Commercial invoice"
            meta="INV-8841.PDF · 340 KB"
            action={<DocStatus>✓ ADDED</DocStatus>}
          />
          <DocumentRow
            name="Packing list"
            meta={packingList ? 'PACKING-8841.PDF · 88 KB' : 'OPTIONAL FOR THIS DEAL'}
            state={packingList ? 'done' : 'empty'}
            roomy
            action={packingList ? <DocStatus>✓ ADDED</DocStatus> : <DocAction>ADD</DocAction>}
            onClick={() => setPackingList(true)}
          />
        </div>

        <Note>
          We check consignee, goods description and vessel against the terms{' '}
          {fixture.buyer.contact.split(' ')[0]} agreed. Mismatches come back to you, not to
          a dispute.
        </Note>

        <div className="spacer">
          <PrimaryButton onClick={present}>Present for verification</PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
