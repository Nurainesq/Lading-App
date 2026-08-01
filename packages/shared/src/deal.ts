/**
 * The deal lifecycle.
 *
 * This is the single source of truth for when money is allowed to move. The
 * API refuses any transition not listed here, so "nobody can move the money
 * while a discrepancy is open — including us" is enforced by the type of the
 * graph rather than by remembering to check.
 */

export const DEAL_STATUSES = [
  'DRAFT',
  'AWAITING_ACCEPTANCE',
  'AWAITING_FUNDING',
  'FUNDED',
  'IN_TRANSIT',
  'DOCUMENTS_PRESENTED',
  'DISCREPANCY',
  'RELEASED',
  'REFUNDED',
  'CANCELLED',
] as const

export type DealStatus = (typeof DEAL_STATUSES)[number]

export const DEAL_EVENTS = [
  'SEND_TO_COUNTERPARTY',
  'PROPOSE_CHANGE',
  'ACCEPT_TERMS',
  'CANCEL',
  'FUNDS_CONFIRMED',
  'CONFIRM_SHIPMENT',
  'PRESENT_DOCUMENTS',
  'RAISE_DISCREPANCY',
  'RESOLVE_WITH_RELEASE',
  'RESOLVE_WITH_REFUND',
  'REPRESENT_DOCUMENTS',
  'RELEASE',
] as const

export type DealEvent = (typeof DEAL_EVENTS)[number]

/** Once a deal is here, nothing else may happen to it. */
export const TERMINAL_STATUSES: readonly DealStatus[] = ['RELEASED', 'REFUNDED', 'CANCELLED']

const TRANSITIONS: Record<DealStatus, Partial<Record<DealEvent, DealStatus>>> = {
  DRAFT: {
    SEND_TO_COUNTERPARTY: 'AWAITING_ACCEPTANCE',
    CANCEL: 'CANCELLED',
  },
  AWAITING_ACCEPTANCE: {
    // The seller can push the terms back rather than only accept or walk away.
    PROPOSE_CHANGE: 'DRAFT',
    ACCEPT_TERMS: 'AWAITING_FUNDING',
    CANCEL: 'CANCELLED',
  },
  AWAITING_FUNDING: {
    // Only ever driven by a confirmed provider webhook, never by a client call.
    FUNDS_CONFIRMED: 'FUNDED',
    CANCEL: 'CANCELLED',
  },
  FUNDED: {
    CONFIRM_SHIPMENT: 'IN_TRANSIT',
    PRESENT_DOCUMENTS: 'DOCUMENTS_PRESENTED',
  },
  IN_TRANSIT: {
    PRESENT_DOCUMENTS: 'DOCUMENTS_PRESENTED',
  },
  DOCUMENTS_PRESENTED: {
    RELEASE: 'RELEASED',
    RAISE_DISCREPANCY: 'DISCREPANCY',
  },
  DISCREPANCY: {
    // Money is frozen here. The only ways out are an agreed resolution or the
    // seller correcting the documents — there is no unilateral release.
    RESOLVE_WITH_RELEASE: 'RELEASED',
    RESOLVE_WITH_REFUND: 'REFUNDED',
    REPRESENT_DOCUMENTS: 'DOCUMENTS_PRESENTED',
  },
  RELEASED: {},
  REFUNDED: {},
  CANCELLED: {},
}

export function isTerminal(status: DealStatus): boolean {
  return TERMINAL_STATUSES.includes(status)
}

/** Whether funds are held in escrow at this point in the lifecycle. */
export function holdsFunds(status: DealStatus): boolean {
  return (
    status === 'FUNDED' ||
    status === 'IN_TRANSIT' ||
    status === 'DOCUMENTS_PRESENTED' ||
    status === 'DISCREPANCY'
  )
}

export function nextStatus(status: DealStatus, event: DealEvent): DealStatus | null {
  return TRANSITIONS[status][event] ?? null
}

export function canTransition(status: DealStatus, event: DealEvent): boolean {
  return nextStatus(status, event) !== null
}

export class IllegalTransitionError extends Error {
  readonly status: DealStatus
  readonly event: DealEvent

  constructor(status: DealStatus, event: DealEvent) {
    super(`${event} is not allowed while the deal is ${status}`)
    this.name = 'IllegalTransitionError'
    this.status = status
    this.event = event
  }
}

/** Returns the new status, or throws. Every state change goes through here. */
export function applyEvent(status: DealStatus, event: DealEvent): DealStatus {
  const next = nextStatus(status, event)
  if (next === null) throw new IllegalTransitionError(status, event)
  return next
}

export function allowedEvents(status: DealStatus): DealEvent[] {
  return Object.keys(TRANSITIONS[status]) as DealEvent[]
}

/** The condition that releases the money. */
export const RELEASE_CONDITIONS = [
  'VERIFIED_BILL_OF_LADING',
  'DELIVERY_CONFIRMATION',
  'SPLIT_SHIPPING_DELIVERY',
] as const

export type ReleaseCondition = (typeof RELEASE_CONDITIONS)[number]

/** The five named checks run against a presented bill of lading. */
export const DOCUMENT_CHECKS = [
  'CONSIGNEE',
  'GOODS_DESCRIPTION',
  'VESSEL_AND_VOYAGE',
  'PORT_OF_DISCHARGE',
  'SHIPPED_ON_BOARD_DATE',
] as const

export type DocumentCheckName = (typeof DOCUMENT_CHECKS)[number]
export type DocumentCheckResult = 'MATCH' | 'MISMATCH' | 'UNREADABLE'

export const DISCREPANCY_REASONS = [
  'DOCUMENT_MISMATCH',
  'QUANTITY_SHORT',
  'SUSPECTED_FORGERY',
  'OTHER',
] as const

export type DiscrepancyReason = (typeof DISCREPANCY_REASONS)[number]

/**
 * Release runs automatically only when every check matched. A single
 * non-match holds the money and hands the decision back to the buyer.
 */
export function checksSatisfyRelease(
  results: { name: DocumentCheckName; result: DocumentCheckResult }[],
): boolean {
  if (results.length !== DOCUMENT_CHECKS.length) return false
  const seen = new Set(results.map((r) => r.name))
  if (seen.size !== DOCUMENT_CHECKS.length) return false
  return results.every((r) => r.result === 'MATCH')
}
