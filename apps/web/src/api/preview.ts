import type { DealDto } from '@lading/shared'

/**
 * A DealDto carrying the design's own LD-4471 figures.
 *
 * The canvas renders all seventeen screens at once, so it must not fire
 * seventeen requests. It renders this instead — the same shape the API
 * returns, so a screen cannot accidentally depend on preview-only fields.
 */

function money(currency: DealDto['value']['currency'], display: string) {
  const minor = Number(display.replace(/[,]/g, '').replace('.', ''))
  return { currency, minor, display }
}

/** The design's populated home — four deals, three counterparties, one settled. */
export function previewDeals(): DealDto[] {
  return [
    previewDeal({
      id: 'preview-4471',
      reference: 'LD-4471',
      status: 'RELEASED',
      sellerName: 'Al Habib Auto Parts',
      route: 'Deira → Tema',
      releasedAt: '2026-08-27T10:00:00.000Z',
    }),
    previewDeal({
      id: 'preview-4488',
      reference: 'LD-4488',
      status: 'IN_TRANSIT',
      sellerName: 'Okeke Trading Co.',
      route: 'Lagos → Accra',
      value: { currency: 'USD', minor: 1_420_000, display: '14,200.00' },
    }),
    previewDeal({
      id: 'preview-4502',
      reference: 'LD-4502',
      status: 'AWAITING_FUNDING',
      sellerName: 'Sunrise Electronics FZE',
      route: 'Deira → Tema',
      value: { currency: 'USD', minor: 3_150_000, display: '31,500.00' },
    }),
    previewDeal({
      id: 'preview-4390',
      reference: 'LD-4390',
      status: 'RELEASED',
      sellerName: 'Ashanti Cashew Ltd',
      route: 'Accra → Mumbai',
      value: { currency: 'USD', minor: 2_270_000, display: '22,700.00' },
      releasedAt: '2026-07-14T10:00:00.000Z',
    }),
  ]
}

export function previewDeal(overrides: Partial<DealDto> = {}): DealDto {
  return {
    id: 'preview-ld-4471',
    reference: 'LD-4471',
    status: 'IN_TRANSIT',
    side: 'BUYING',

    buyerName: 'Mensah Auto, Accra',
    sellerName: 'Al Habib Auto Parts',
    goods: 'Toyota & Nissan spare parts',
    route: 'Deira → Tema',

    value: money('USD', '28,000.00'),
    totalDue: money('GHS', '344,162.00'),
    fee: money('GHS', '2,562.00'),
    settlementAmount: money('AED', '102,844.00'),
    rateLockedAt: '2026-08-01T14:41:00.000Z',

    releaseCondition: 'VERIFIED_BILL_OF_LADING',
    escrowAccount: {
      accountName: 'LADING ESCROW / LD-4471',
      accountNumber: '1904 4471 2280',
      bankName: 'WeWire',
      iban: null,
      currency: 'GHS',
      status: 'ACTIVE',
      heldBy: 'WeWire — licensed, safeguarded. Lading has release rights only, never custody.',
    },

    windowDays: 26,
    dayOfWindow: 12,

    documents: [
      {
        id: 'doc-bl',
        kind: 'BILL_OF_LADING',
        filename: 'MSCU-2249173.PDF',
        sizeBytes: 1_258_291,
        uploadedAt: '2026-08-12T09:00:00.000Z',
      },
      {
        id: 'doc-invoice',
        kind: 'COMMERCIAL_INVOICE',
        filename: 'INV-8841.PDF',
        sizeBytes: 348_160,
        uploadedAt: '2026-08-12T09:01:00.000Z',
      },
    ],
    checks: [
      { name: 'CONSIGNEE', result: 'MATCH', detail: null },
      { name: 'GOODS_DESCRIPTION', result: 'MATCH', detail: null },
      { name: 'VESSEL_AND_VOYAGE', result: 'MATCH', detail: null },
      { name: 'PORT_OF_DISCHARGE', result: 'MATCH', detail: null },
      { name: 'SHIPPED_ON_BOARD_DATE', result: 'MATCH', detail: null },
    ],
    timeline: [
      {
        id: 't1',
        kind: 'FUNDED',
        label: 'Escrow funded',
        detail: null,
        occurredAt: '2026-08-01T14:41:00.000Z',
      },
      {
        id: 't2',
        kind: 'SHIPPED',
        label: 'Seller confirmed shipment',
        detail: 'MSC AMSTERDAM',
        occurredAt: '2026-08-04T10:00:00.000Z',
      },
    ],

    // Only a deal still awaiting acceptance carries a link, and the canvas
    // shows the journey past that point.
    inviteUrl: null,

    createdAt: '2026-08-01T12:00:00.000Z',
    fundedAt: '2026-08-01T14:41:00.000Z',
    releasedAt: null,

    ...overrides,
  }
}
