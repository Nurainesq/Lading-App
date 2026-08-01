import type { Currency, Money } from '@lading/shared'

/**
 * The escrow provider seam.
 *
 * Lading never takes custody of funds, so everything that touches money is
 * behind this interface: the real WeWire client in production, an in-memory
 * double in development and tests. Nothing above this line knows which is
 * running.
 */

export type AccountStatus =
  | 'REQUESTED'
  | 'PENDING'
  | 'DENIED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'CLOSED'

export interface ProviderAccount {
  id: string
  accountName: string
  accountNumber: string | null
  bankName: string | null
  bankCode: string | null
  iban: string | null
  bic: string | null
  sortCode: string | null
  routingNumber: string | null
  currency: Currency
  status: AccountStatus
}

export type TransferStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REVERSED' | 'CANCELLED'

export interface ProviderTransfer {
  id: string
  status: TransferStatus
  amount: Money
  fee: Money | null
  reference: string | null
}

export type GhanaChannel = 'MOBILE_MONEY' | 'BANK'

export interface CollectionRequest {
  /** Max 140 chars. Replaying the same key must not take the money twice. */
  idempotencyKey: string
  amount: Money
  channel: GhanaChannel
  /** Three-letter network or bank code: MTN, VOD, ATM, GCB, ECO, GTB. */
  accountCode: string
  accountNumber: string
  accountName: string
  reference?: string
  memo?: string
}

export interface PayoutRequest {
  idempotencyKey: string
  amount: Money
  beneficiaryId: string
  beneficiaryAccountId: string
  reference?: string
  purposeCode?: string
}

export interface RateQuote {
  from: Currency
  to: Currency
  /** rate = scaledRate / 10^scale, integer so it can be stored and replayed. */
  scaledRate: number
  scale: number
  quoteId: string | null
  expiresAt: Date
}

export interface EscrowProvider {
  readonly name: 'wewire' | 'mock'

  /** Issues the per-deal virtual account. Nothing else is paid into it. */
  requestAccount(input: {
    subCustomerId: string
    currency: Currency
    reference: string
  }): Promise<ProviderAccount>

  getAccount(input: { subCustomerId: string; accountId: string }): Promise<ProviderAccount>

  /** Ghana corridor pay-in: bank transfer or mobile money. */
  collect(input: CollectionRequest): Promise<ProviderTransfer>

  /** Pays the seller once the release condition is satisfied. */
  payout(input: PayoutRequest): Promise<ProviderTransfer>

  getRate(input: { from: Currency; to: Currency }): Promise<RateQuote>

  getTransaction(input: { transactionId: string }): Promise<ProviderTransfer>
}

export class ProviderError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(message: string, options: { status: number; code: string; requestId?: string | null }) {
    super(message)
    this.name = 'ProviderError'
    this.status = options.status
    this.code = options.code
    this.requestId = options.requestId ?? null
  }

  /** Whether retrying the identical request could plausibly succeed. */
  get retryable(): boolean {
    return this.status === 429 || this.status >= 500
  }
}
