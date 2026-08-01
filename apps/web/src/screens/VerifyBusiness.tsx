import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { DocAction, DocStatus, DocumentRow } from '@/components/Document'
import { Note } from '@/components/Note'
import { Steps } from '@/components/Progress'

/** 02 — Business verification. Three documents, progress always visible. */
export function VerifyBusiness() {
  const navigate = useNavigate()
  const [addressSupplied, setAddressSupplied] = useState(false)

  return (
    <Screen label="Verify business">
      <StatusBar />
      <NavBar label="VERIFY BUSINESS · STEP 2 OF 3" onBack={() => navigate('/')} />
      <Content gap={24}>
        <Steps total={3} done={addressSupplied ? 3 : 2} />
        <Title size={32}>Your business documents</Title>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <DocumentRow
            name="Certificate of incorporation"
            meta="RGD-GH · UPLOADED"
            action={<DocStatus>✓ DONE</DocStatus>}
          />
          <DocumentRow
            name="Director ID"
            meta="GHANA CARD · UPLOADED"
            action={<DocStatus>✓ DONE</DocStatus>}
          />
          <DocumentRow
            name="Proof of business address"
            meta={addressSupplied ? 'UTILITY BILL · UPLOADED' : 'UTILITY BILL OR TENANCY'}
            state={addressSupplied ? 'done' : 'empty'}
            action={addressSupplied ? <DocStatus>✓ DONE</DocStatus> : <DocAction>UPLOAD</DocAction>}
            onClick={() => setAddressSupplied(true)}
          />
        </div>

        <div
          className="spacer"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Note>
            Verification runs against WeWire's KYB checks. Most businesses clear within a
            working day.
          </Note>
          <PrimaryButton onClick={() => navigate('/deals')}>Submit for review</PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
