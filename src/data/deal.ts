/**
 * LD-4471 — the deal the whole design is written around.
 * Kwame (buyer, Accra) and Rashid (seller, Deira): $28,000 of auto parts, 26 days.
 *
 * Every figure here is taken from the design source rather than recomputed, so
 * the screens stay faithful to the mock. Rates are shown as locked for the full
 * window, which is why nothing derives GHS from USD at render time.
 */

export type DealStatus =
  | 'draft'
  | 'awaiting-acceptance'
  | 'awaiting-funding'
  | 'funded'
  | 'in-transit'
  | 'documents-presented'
  | 'discrepancy'
  | 'released'

export type ReleaseConditionId = 'verified-bl' | 'delivery-confirmation' | 'split'

export interface ReleaseCondition {
  id: ReleaseConditionId
  label: string
  detail?: string
}

export const releaseConditions: ReleaseCondition[] = [
  {
    id: 'verified-bl',
    label: 'Bill of lading presented and verified',
    detail: 'Must match consignee, goods description and vessel on these terms.',
  },
  { id: 'delivery-confirmation', label: 'On delivery confirmation at Tema' },
  { id: 'split', label: 'Split: 50% on shipping, 50% on delivery' },
]

export const deal = {
  reference: 'LD-4471',

  buyer: {
    contact: 'Kwame Mensah',
    business: 'Mensah Auto Ltd',
    short: 'Mensah Auto, Accra',
    city: 'Accra',
    country: 'Ghana',
  },
  seller: {
    business: 'Al Habib Auto Parts LLC',
    short: 'Al Habib Auto Parts',
    city: 'Deira',
    country: 'United Arab Emirates',
    contact: '+971 50 448 2210',
  },

  goods: 'Toyota & Nissan spare parts',
  consignment: 'Toyota & Nissan replacement parts',
  route: 'Deira → Tema',
  portOfLoading: 'Jebel Ali',
  portOfDischarge: 'Tema',

  /** Escrowed value, in the deal currency. */
  value: { currency: 'USD', amount: '28,000.00' },
  /** What the buyer funds, in his own currency. */
  buyerFunds: { currency: 'GHS', amount: '341,600.00' },
  fee: { currency: 'GHS', amount: '2,562.00' },
  totalDue: { currency: 'GHS', amount: '344,162.00' },
  /** What the seller receives, in his own currency. */
  sellerReceives: { currency: 'AED', amount: '102,844.00' },

  windowDays: 26,
  dayOfWindow: 12,
  /** Voyage progress at day 12 of 26, as drawn in the mock. */
  voyageProgressPct: 46,

  escrowAccount: {
    name: 'LADING ESCROW / LD-4471',
    number: '1904 4471 2280',
    heldBy:
      'WeWire — licensed, safeguarded. Lading has release rights only, never custody.',
  },

  releaseCondition: 'verified-bl' as ReleaseConditionId,
  releaseConditionShort: 'Verified B/L',

  vessel: 'MSC AMSTERDAM',
  billOfLading: 'MSCU-2249173',

  dates: {
    accepted: '14:02 GMT',
    funded: '01 AUG · 14:41 GMT',
    fundedShort: '01 AUG · 14:41',
    departed: 'JEBEL ALI · 04 AUG',
    shipmentConfirmed: '04 AUG · MSC AMSTERDAM',
    arrivalEst: 'TEMA · 27 AUG EST',
    certificate: 'LD-4471 · 27 AUG 2026',
    settlement: '41 minutes after the bill of lading was verified',
  },

  fx: {
    movementLabel: 'FX MOVEMENT SINCE FUNDING',
    movement: 'Cedi down 3.1% — costs you nothing',
  },
} as const

/** The five named checks run against the presented bill of lading. */
export const documentChecks = [
  'Consignee',
  'Goods description',
  'Vessel & voyage',
  'Port of discharge',
  'Shipped on board date',
] as const

/** Reasons a buyer can hold a release. */
export const discrepancyReasons = [
  { id: 'mismatch', label: "Document doesn't match the goods" },
  {
    id: 'short',
    label: 'Quantity short of the agreed order',
    detail: 'Propose a partial release for what did ship.',
  },
  { id: 'forged', label: 'Suspected forged document' },
  { id: 'other', label: 'Something else' },
] as const

/** The buyer's settled and running deals, as shown on the populated home. */
export const tradeRecord = {
  settledCount: 4,
  escrowedToDate: 'USD 96,400',
  deals: [
    {
      counterparty: 'Al Habib Auto Parts',
      status: 'RELEASED',
      tone: 'oxide' as const,
      reference: 'LD-4471 · DEIRA → TEMA',
      value: 'USD 28,000',
    },
    {
      counterparty: 'Okeke Trading Co.',
      status: 'IN TRANSIT',
      tone: 'slate' as const,
      reference: 'LD-4488 · LAGOS → ACCRA',
      value: 'USD 14,200',
    },
    {
      counterparty: 'Sunrise Electronics FZE',
      status: 'AWAITING FUNDING',
      tone: 'dim' as const,
      reference: 'LD-4502 · DEIRA → TEMA',
      value: 'USD 31,500',
    },
    {
      counterparty: 'Ashanti Cashew Ltd',
      status: 'RELEASED',
      tone: 'oxide' as const,
      reference: 'LD-4390 · ACCRA → MUMBAI',
      value: 'USD 22,700',
    },
  ],
}
