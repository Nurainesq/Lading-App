import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DealProvider, useDeal } from '@/state/DealContext'
import { Canvas } from '@/canvas/Canvas'
import { SignIn } from '@/screens/SignIn'
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
import type { ReactNode } from 'react'

/** Home is one screen with two states — empty until a deal has settled. */
function Deals() {
  const deal = useDeal()
  return <Home populated={deal.hasHistory} />
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
        <Route path="/verify" element={<VerifyBusiness />} />
        <Route path="/deals" element={<Deals />} />

        <Route path="/deal/new/counterparty" element={<NewDealCounterparty />} />
        <Route path="/deal/new/terms" element={<NewDealTerms />} />
        <Route path="/deal/new/review" element={<NewDealReview />} />

        <Route path="/seller/accept" element={<SellerAccept />} />
        <Route path="/seller/present" element={<SellerPresentDocuments />} />

        <Route path="/deal" element={<DealTimeline />} />
        <Route path="/deal/account" element={<EscrowAccount />} />
        <Route path="/deal/fund" element={<FundEscrow />} />
        <Route path="/deal/funded" element={<Funded />} />
        <Route path="/deal/verification" element={<DocumentCheck />} />
        <Route path="/deal/discrepancy" element={<Discrepancy />} />
        <Route path="/deal/released" element={<Released />} />
        <Route path="/deal/certificate" element={<ReleaseCertificate />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Stage>
  )
}

export default function App() {
  return (
    <DealProvider>
      <AppRoutes />
    </DealProvider>
  )
}
