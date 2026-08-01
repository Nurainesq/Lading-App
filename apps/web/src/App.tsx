import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { SessionProvider } from '@/state/SessionContext'
import { DraftProvider } from '@/state/DraftContext'
import { DealProvider } from '@/state/DealContext'
import { DealGate } from '@/state/DealGate'
import { Canvas } from '@/canvas/Canvas'
import { SignIn } from '@/screens/SignIn'
import { VerifyCode } from '@/screens/VerifyCode'
import { VerifyBusiness } from '@/screens/VerifyBusiness'
import { Home } from '@/screens/Home'
import { NewDealCounterparty } from '@/screens/NewDealCounterparty'
import { NewDealTerms } from '@/screens/NewDealTerms'
import { NewDealReview } from '@/screens/NewDealReview'
import { SellerAccept } from '@/screens/SellerAccept'
import { EscrowAccount } from '@/screens/EscrowAccount'
import { FundEscrow } from '@/screens/FundEscrow'
import { Funded } from '@/screens/Funded'
import { DealTimeline } from '@/screens/DealTimeline'
import { SellerPresentDocuments } from '@/screens/SellerPresentDocuments'
import { DocumentCheck } from '@/screens/DocumentCheck'
import { Discrepancy } from '@/screens/Discrepancy'
import { Released } from '@/screens/Released'
import { ReleaseCertificate } from '@/screens/ReleaseCertificate'

/** Loads the deal named in the URL and puts it in scope for the screen. */
function WithDeal({ children }: { children: ReactNode }) {
  const { id } = useParams()
  return (
    <DealProvider dealId={id ?? null}>
      <DealGate>{children}</DealGate>
    </DealProvider>
  )
}

/** The device sits on the canvas ground; on a phone it fills the viewport. */
function Stage({ children }: { children: ReactNode }) {
  return <div className="stage">{children}</div>
}

function AppRoutes() {
  const location = useLocation()

  // The canvas is a full-bleed review surface, not a device screen.
  if (location.pathname === '/canvas') {
    return <Canvas />
  }

  return (
    <Stage>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/sign-in/code" element={<VerifyCode />} />
        <Route path="/verify" element={<VerifyBusiness />} />
        <Route path="/deals" element={<Home />} />

        <Route path="/deal/new/counterparty" element={<NewDealCounterparty />} />
        <Route path="/deal/new/terms" element={<NewDealTerms />} />
        <Route path="/deal/new/review" element={<NewDealReview />} />

        {/* The seller arrives here from a link, with no account. */}
        <Route path="/invite/:token" element={<SellerAccept />} />

        <Route
          path="/deal/:id"
          element={
            <WithDeal>
              <DealTimeline />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/account"
          element={
            <WithDeal>
              <EscrowAccount />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/fund"
          element={
            <WithDeal>
              <FundEscrow />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/funded"
          element={
            <WithDeal>
              <Funded />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/present"
          element={
            <WithDeal>
              <SellerPresentDocuments />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/verification"
          element={
            <WithDeal>
              <DocumentCheck />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/discrepancy"
          element={
            <WithDeal>
              <Discrepancy />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/released"
          element={
            <WithDeal>
              <Released />
            </WithDeal>
          }
        />
        <Route
          path="/deal/:id/certificate"
          element={
            <WithDeal>
              <ReleaseCertificate />
            </WithDeal>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Stage>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <DraftProvider>
        <AppRoutes />
      </DraftProvider>
    </SessionProvider>
  )
}
