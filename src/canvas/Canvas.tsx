import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
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
import './canvas.css'

interface Stage {
  no: string
  name: string
  blurb: string
  screens: { no: string; caption: string; render: () => ReactNode }[]
}

const stages: Stage[] = [
  {
    no: 'STAGE 01',
    name: 'Get verified',
    blurb: 'Once, before the first deal. Business identity, not personal.',
    screens: [
      {
        no: '01',
        caption: 'Sign in — the promise stated in one line, before any form.',
        render: () => <SignIn />,
      },
      {
        no: '02',
        caption: 'Business verification — three documents, progress always visible.',
        render: () => <VerifyBusiness />,
      },
    ],
  },
  {
    no: 'STAGE 02',
    name: 'Write the deal',
    blurb: 'Counterparty, terms, and the one condition that releases the money.',
    screens: [
      {
        no: '03',
        caption: 'Empty home — answers the first objection: does my supplier need this app?',
        render: () => <Home />,
      },
      {
        no: '04',
        caption: 'Counterparty — side first, because it drives everything after.',
        render: () => <NewDealCounterparty />,
      },
      {
        no: '05',
        caption: 'The conditions engine, made plain: one sentence decides the release.',
        render: () => <NewDealTerms />,
      },
      {
        no: '06',
        caption: 'Every number the buyer will be held to, before he commits.',
        render: () => <NewDealReview />,
      },
    ],
  },
  {
    no: 'STAGE 03',
    name: 'Accept and fund',
    blurb: 'The seller sees the money exists. He never holds it.',
    screens: [
      {
        no: '07',
        caption: "Seller's first screen ever — paper ground, arrives by link, no account.",
        render: () => <SellerAccept />,
      },
      {
        no: '08',
        caption: 'The virtual account, shown as an instrument — the escrow made tangible.',
        render: () => <EscrowAccount />,
      },
      {
        no: '09',
        caption:
          'Funding — the stablecoin layer explained as FX protection, never as crypto.',
        render: () => <FundEscrow />,
      },
      {
        no: '10',
        caption: 'The emotional peak for both sides — stamped, not celebratory.',
        render: () => <Funded />,
      },
    ],
  },
  {
    no: 'STAGE 04',
    name: 'The 26 days',
    blurb: 'Where trust normally decays. Here it is just a timeline and a document.',
    screens: [
      {
        no: '11',
        caption:
          "Deal timeline — the FX line quietly proves the product's core claim mid-voyage.",
        render: () => <DealTimeline />,
      },
      {
        no: '12',
        caption: 'Seller presents documents — the document layer, in the language of trade.',
        render: () => <SellerPresentDocuments />,
      },
      {
        no: '13',
        caption: "Verification — five named checks, and a dispute path that isn't hidden.",
        render: () => <DocumentCheck />,
      },
      {
        no: '14',
        caption: 'The unhappy path — the screen that decides whether traders believe you.',
        render: () => <Discrepancy />,
      },
    ],
  },
  {
    no: 'STAGE 05',
    name: 'Release and record',
    blurb: 'The settled deal becomes the trade history that unlocks credit later.',
    screens: [
      {
        no: '15',
        caption: 'Release — and immediately the repeat-deal prompt, where retention lives.',
        render: () => <Released />,
      },
      {
        no: '16',
        caption: 'The certificate — a document a bank or insurer will accept later.',
        render: () => <ReleaseCertificate />,
      },
      {
        no: '17',
        caption: 'Home, populated — the trade-data revenue line visible from day one.',
        render: () => <Home populated />,
      },
    ],
  },
]

/** Freezes a preview so it cannot be clicked or tabbed into from the canvas. */
function Preview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.setAttribute('inert', '')
  }, [])

  return (
    <div className="canvas__preview" ref={ref}>
      {children}
    </div>
  )
}

/**
 * The complete journey on one surface, matching the source design document.
 * Useful for review; the app itself is at `/`.
 */
export function Canvas() {
  return (
    <div className="canvas">
      <header className="canvas__intro">
        <div className="canvas__eyebrow">
          <Logo size={30} />
          <span className="canvas__eyebrow-text">
            Mobile app · complete journey · 17 screens
          </span>
        </div>
        <h1 className="canvas__title">One deal, end to end</h1>
        <p className="canvas__lede">
          Kwame (buyer, Accra) and Rashid (seller, Deira) run LD-4471 — $28,000 of auto
          parts, 26 days. Buyer screens on ink, seller screens marked{' '}
          <span className="mono oxide">SELLER VIEW</span>. Oxide appears only where value
          moves or a condition is met. Every action target is at least 44px tall.
        </p>
      </header>

      {stages.map((stage) => (
        <section className="canvas__stage" key={stage.no}>
          <div className="canvas__stage-head">
            <span className="canvas__stage-no">{stage.no}</span>
            <h2 className="canvas__stage-name" style={{ margin: 0, fontWeight: 400 }}>
              {stage.name}
            </h2>
            <span className="canvas__stage-blurb">{stage.blurb}</span>
          </div>
          <div className="canvas__row">
            {stage.screens.map((screen) => (
              <figure className="canvas__item" key={screen.no} style={{ margin: 0 }}>
                <Preview>{screen.render()}</Preview>
                <figcaption className="canvas__caption">
                  <span className="canvas__caption-no">{screen.no}</span>
                  <span className="canvas__caption-text">{screen.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}

      <Link className="canvas__back" to="/">
        OPEN THE APP →
      </Link>
    </div>
  )
}
