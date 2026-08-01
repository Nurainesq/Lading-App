import { formatMoney, parseMoney, type Currency, type Money } from '@lading/shared'
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
 * WeWire API client.
 *
 * Authentication is a raw `ww-api-key` header (no Bearer prefix). Amounts on
 * the wire are major-unit decimal strings, so every crossing of this boundary
 * converts explicitly — internally the service only ever holds minor units.
 *
 * Written against the published API. It has not been exercised against a live
 * sandbox in this repository, because that needs a real `sk_test_` key.
 */

interface ClientOptions {
  apiKey: string
  baseUrl: string
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

interface WeWireAccount {
  id: string
  accountName?: string | null
  accountNumber?: string | null
  bankName?: string | null
  bankCode?: string | null
  iban?: string | null
  bic?: string | null
  sortCode?: string | null
  routingNumber?: string | null
  currency: string
  status: string
}

interface WeWireTransfer {
  id: string
  status: string
  amount: string | number
  currency: string
  fee?: string | number | null
  reference?: string | null
}

const ACCOUNT_STATUSES = new Set([
  'REQUESTED',
  'PENDING',
  'DENIED',
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
])

const TRANSFER_STATUSES = new Set(['PENDING', 'SUCCESSFUL', 'FAILED', 'REVERSED', 'CANCELLED'])

export class WeWireClient implements EscrowProvider {
  readonly name = 'wewire' as const

  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #fetch: typeof fetch
  readonly #timeoutMs: number

  constructor({ apiKey, baseUrl, fetchImpl = fetch, timeoutMs = 20_000 }: ClientOptions) {
    this.#apiKey = apiKey
    this.#baseUrl = baseUrl.replace(/\/+$/, '')
    this.#fetch = fetchImpl
    this.#timeoutMs = timeoutMs
  }

  async #request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs)

    const headers: Record<string, string> = {
      // Verbatim key, no Bearer prefix — WeWire's scheme.
      'ww-api-key': this.#apiKey,
      accept: 'application/json',
    }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey

    let response: Response
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (cause) {
      const aborted = cause instanceof Error && cause.name === 'AbortError'
      throw new ProviderError(
        aborted ? `WeWire request timed out after ${this.#timeoutMs}ms` : 'WeWire request failed',
        // 503 so the caller's retryable check treats a transport failure as
        // worth retrying, unlike a 4xx.
        { status: 503, code: aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNREACHABLE' },
      )
    } finally {
      clearTimeout(timer)
    }

    const requestId = response.headers.get('x-request-id')
    const text = await response.text()

    if (!response.ok) {
      let code = `HTTP_${response.status}`
      let message = text.slice(0, 500) || response.statusText
      try {
        const parsed = JSON.parse(text) as { code?: string; message?: string; error?: string }
        code = parsed.code ?? code
        message = parsed.message ?? parsed.error ?? message
      } catch {
        // Non-JSON error body; the raw text above is the best we have.
      }
      throw new ProviderError(`WeWire ${method} ${path}: ${message}`, {
        status: response.status,
        code,
        requestId,
      })
    }

    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      throw new ProviderError(`WeWire ${method} ${path}: response was not JSON`, {
        status: response.status,
        code: 'PROVIDER_BAD_RESPONSE',
        requestId,
      })
    }
  }

  #toAccount(raw: WeWireAccount, fallbackName: string): ProviderAccount {
    const status = String(raw.status).toUpperCase()
    return {
      id: raw.id,
      accountName: raw.accountName ?? fallbackName,
      accountNumber: raw.accountNumber ?? null,
      bankName: raw.bankName ?? null,
      bankCode: raw.bankCode ?? null,
      iban: raw.iban ?? null,
      bic: raw.bic ?? null,
      sortCode: raw.sortCode ?? null,
      routingNumber: raw.routingNumber ?? null,
      currency: raw.currency as Currency,
      status: ACCOUNT_STATUSES.has(status) ? (status as ProviderAccount['status']) : 'PENDING',
    }
  }

  #toTransfer(raw: WeWireTransfer): ProviderTransfer {
    const status = String(raw.status).toUpperCase()
    const currency = raw.currency as Currency
    return {
      id: raw.id,
      // An unrecognised status must not read as success — money would be
      // released against a transfer that never settled.
      status: TRANSFER_STATUSES.has(status)
        ? (status as ProviderTransfer['status'])
        : 'PENDING',
      amount: parseMoney(currency, String(raw.amount)),
      fee:
        raw.fee === null || raw.fee === undefined
          ? null
          : parseMoney(currency, String(raw.fee)),
      reference: raw.reference ?? null,
    }
  }

  async requestAccount({
    subCustomerId,
    currency,
    reference,
  }: {
    subCustomerId: string
    currency: Currency
    reference: string
  }): Promise<ProviderAccount> {
    const raw = await this.#request<WeWireAccount>(
      'POST',
      `/v1/subcustomers/${encodeURIComponent(subCustomerId)}/accounts/request`,
      { currency },
      reference,
    )
    return this.#toAccount(raw, `LADING ESCROW / ${reference}`)
  }

  async getAccount({
    subCustomerId,
    accountId,
  }: {
    subCustomerId: string
    accountId: string
  }): Promise<ProviderAccount> {
    const raw = await this.#request<WeWireAccount>(
      'GET',
      `/v1/subcustomers/${encodeURIComponent(subCustomerId)}/accounts/${encodeURIComponent(accountId)}`,
    )
    return this.#toAccount(raw, 'LADING ESCROW')
  }

  async collect(input: CollectionRequest): Promise<ProviderTransfer> {
    const raw = await this.#request<WeWireTransfer>(
      'POST',
      '/v1/collections',
      {
        idempotencyKey: input.idempotencyKey,
        // Major units as a decimal string — the API's unit, not ours.
        amount: formatMoney(input.amount),
        currency: input.amount.currency,
        channel: input.channel,
        accountCode: input.accountCode.toUpperCase(),
        accountNumber: input.accountNumber,
        accountName: input.accountName.slice(0, 120),
        reference: input.reference,
        memo: input.memo,
      },
      input.idempotencyKey,
    )
    return this.#toTransfer(raw)
  }

  async payout(input: PayoutRequest): Promise<ProviderTransfer> {
    const raw = await this.#request<WeWireTransfer>(
      'POST',
      '/v1/transactions/payout',
      {
        idempotencyKey: input.idempotencyKey,
        amount: formatMoney(input.amount),
        currency: input.amount.currency,
        beneficiaryId: input.beneficiaryId,
        beneficiaryAccountId: input.beneficiaryAccountId,
        reference: input.reference,
        purposeCode: input.purposeCode,
      },
      input.idempotencyKey,
    )
    return this.#toTransfer(raw)
  }

  async getRate({ from, to }: { from: Currency; to: Currency }): Promise<RateQuote> {
    const raw = await this.#request<{ rate: string | number; quoteId?: string; expiresAt?: string }>(
      'GET',
      `/v1/rates/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
    )
    return toRateQuote(from, to, raw)
  }

  async getTransaction({ transactionId }: { transactionId: string }): Promise<ProviderTransfer> {
    const raw = await this.#request<WeWireTransfer>(
      'GET',
      `/v1/transactions/${encodeURIComponent(transactionId)}`,
    )
    return this.#toTransfer(raw)
  }
}

/** Scale 6 keeps sub-pesewa precision on a rate like 12.2 GHS/USD. */
export const RATE_SCALE = 6

export function toRateQuote(
  from: Currency,
  to: Currency,
  raw: { rate: string | number; quoteId?: string; expiresAt?: string },
): RateQuote {
  const decimal = String(raw.rate)
  const match = /^(\d+)(?:\.(\d+))?$/.exec(decimal)
  if (!match) {
    throw new ProviderError(`WeWire returned an unparseable rate "${decimal}"`, {
      status: 502,
      code: 'PROVIDER_BAD_RATE',
    })
  }
  const [, whole, fraction = ''] = match
  const truncated = fraction.slice(0, RATE_SCALE).padEnd(RATE_SCALE, '0')
  return {
    from,
    to,
    scaledRate: Number(`${whole}${truncated}`),
    scale: RATE_SCALE,
    quoteId: raw.quoteId ?? null,
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : new Date(Date.now() + 60_000),
  }
}

export type { Money }
