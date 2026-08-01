import { money, type Currency } from '@lading/shared'
import { RATE_SCALE } from './client.ts'
import {
  ProviderError,
  type CollectionRequest,
  type EscrowProvider,
  type PayoutRequest,
  type ProviderAccount,
  type ProviderTransfer,
  type RateQuote,
} from './provider.ts'

/**
 * In-memory escrow provider.
 *
 * Lets the whole journey run — and be tested — without WeWire credentials. It
 * is deliberately strict about idempotency so that a bug which would double-
 * charge a trader against the real API also fails here.
 */

/** Indicative rates, for development only. Never used when ESCROW_PROVIDER=wewire. */
const RATES: Record<string, number> = {
  'USD:GHS': 12.2,
  'GHS:USD': 0.081967,
  'USD:AED': 3.6730,
  'AED:USD': 0.272257,
  'GHS:AED': 0.301066,
  'AED:GHS': 3.321,
}

export class MockEscrowProvider implements EscrowProvider {
  readonly name = 'mock' as const

  #sequence = 0
  readonly #accounts = new Map<string, ProviderAccount>()
  readonly #transfers = new Map<string, ProviderTransfer>()
  /** idempotencyKey -> transfer id, so a replay returns the original. */
  readonly #byIdempotencyKey = new Map<string, string>()

  #nextId(prefix: string): string {
    this.#sequence += 1
    return `${prefix}_mock${String(this.#sequence).padStart(6, '0')}`
  }

  async requestAccount({
    currency,
    reference,
  }: {
    subCustomerId: string
    currency: Currency
    reference: string
  }): Promise<ProviderAccount> {
    const id = this.#nextId('acct')
    const digits = String(1_000_000_000 + this.#sequence * 7_919).slice(0, 10)
    const account: ProviderAccount = {
      id,
      accountName: `LADING ESCROW / ${reference}`,
      accountNumber: `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}${reference.slice(-2)}`,
      bankName: 'WeWire Sandbox Bank',
      bankCode: 'WWB',
      iban: null,
      bic: null,
      sortCode: null,
      routingNumber: null,
      currency,
      status: 'ACTIVE',
    }
    this.#accounts.set(id, account)
    return account
  }

  async getAccount({ accountId }: { subCustomerId: string; accountId: string }) {
    const account = this.#accounts.get(accountId)
    if (!account) {
      throw new ProviderError(`No such account ${accountId}`, { status: 404, code: 'NOT_FOUND' })
    }
    return account
  }

  #replayOrCreate(key: string, build: () => ProviderTransfer): ProviderTransfer {
    const existing = this.#byIdempotencyKey.get(key)
    if (existing) {
      const transfer = this.#transfers.get(existing)
      if (transfer) return transfer
    }
    const transfer = build()
    this.#transfers.set(transfer.id, transfer)
    this.#byIdempotencyKey.set(key, transfer.id)
    return transfer
  }

  async collect(input: CollectionRequest): Promise<ProviderTransfer> {
    if (input.amount.minor <= 0) {
      throw new ProviderError('Collection amount must be positive', {
        status: 422,
        code: 'INVALID_AMOUNT',
      })
    }
    return this.#replayOrCreate(input.idempotencyKey, () => ({
      id: this.#nextId('txn'),
      // Real collections settle asynchronously; the webhook completes them.
      status: 'PENDING',
      amount: input.amount,
      fee: money(input.amount.currency, 0),
      reference: input.reference ?? null,
    }))
  }

  async payout(input: PayoutRequest): Promise<ProviderTransfer> {
    return this.#replayOrCreate(input.idempotencyKey, () => ({
      id: this.#nextId('txn'),
      status: 'PENDING',
      amount: input.amount,
      fee: money(input.amount.currency, 0),
      reference: input.reference ?? null,
    }))
  }

  async getRate({ from, to }: { from: Currency; to: Currency }): Promise<RateQuote> {
    if (from === to) {
      return {
        from,
        to,
        scaledRate: 10 ** RATE_SCALE,
        scale: RATE_SCALE,
        quoteId: null,
        expiresAt: new Date(Date.now() + 60_000),
      }
    }
    const rate = RATES[`${from}:${to}`]
    if (rate === undefined) {
      throw new ProviderError(`No mock rate for ${from}/${to}`, {
        status: 422,
        code: 'UNSUPPORTED_PAIR',
      })
    }
    return {
      from,
      to,
      scaledRate: Math.round(rate * 10 ** RATE_SCALE),
      scale: RATE_SCALE,
      quoteId: this.#nextId('quote'),
      expiresAt: new Date(Date.now() + 60_000),
    }
  }

  async getTransaction({ transactionId }: { transactionId: string }): Promise<ProviderTransfer> {
    const transfer = this.#transfers.get(transactionId)
    if (!transfer) {
      throw new ProviderError(`No such transaction ${transactionId}`, {
        status: 404,
        code: 'NOT_FOUND',
      })
    }
    return transfer
  }

  /** Test hook: settle a pending transfer the way a webhook would. */
  settle(transactionId: string, status: ProviderTransfer['status'] = 'SUCCESSFUL'): void {
    const transfer = this.#transfers.get(transactionId)
    if (!transfer) throw new Error(`No such transaction ${transactionId}`)
    this.#transfers.set(transactionId, { ...transfer, status })
  }
}
