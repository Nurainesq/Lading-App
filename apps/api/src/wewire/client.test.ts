import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMoney } from '@lading/shared'
import { WeWireClient, toRateQuote } from './client.ts'
import { ProviderError } from './provider.ts'
import { MockEscrowProvider } from './mock.ts'

interface Captured {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

function stubFetch(response: { status?: number; body?: unknown; text?: string }) {
  const calls: Captured[] = []
  const impl: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const text = response.text ?? JSON.stringify(response.body ?? {})
    return new Response(text, {
      status: response.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  return { impl, calls }
}

const base = { apiKey: 'sk_test_abc123', baseUrl: 'https://stage-capi.wewireafrica.com' }

test('authenticates with a raw ww-api-key header', async () => {
  const { impl, calls } = stubFetch({
    body: { id: 'acct_1', currency: 'USD', status: 'ACTIVE', accountNumber: '1904447122' },
  })
  const client = new WeWireClient({ ...base, fetchImpl: impl })
  await client.requestAccount({ subCustomerId: 'sub_1', currency: 'USD', reference: 'LD-4471' })

  assert.equal(calls[0]?.headers['ww-api-key'], 'sk_test_abc123')
  // No Bearer prefix, and no Authorization header at all.
  assert.equal(calls[0]?.headers['authorization'], undefined)
  assert.equal(
    calls[0]?.url,
    'https://stage-capi.wewireafrica.com/v1/subcustomers/sub_1/accounts/request',
  )
  assert.deepEqual(calls[0]?.body, { currency: 'USD' })
})

test('sends collection amounts as major-unit decimal strings', async () => {
  const { impl, calls } = stubFetch({
    status: 202,
    body: { id: 'txn_1', status: 'PENDING', amount: '344162.00', currency: 'GHS' },
  })
  const client = new WeWireClient({ ...base, fetchImpl: impl })

  const transfer = await client.collect({
    idempotencyKey: 'LD-4471-fund-1',
    amount: parseMoney('GHS', '344,162.00'),
    channel: 'MOBILE_MONEY',
    accountCode: 'mtn',
    accountNumber: '0244123456',
    accountName: 'Mensah Auto Ltd',
  })

  const body = calls[0]?.body as Record<string, unknown>
  // Minor units internally, major units on the wire — and never a float.
  assert.equal(body.amount, '344162.00')
  assert.equal(body.currency, 'GHS')
  assert.equal(body.accountCode, 'MTN', 'network code is upper-cased')
  assert.equal(calls[0]?.headers['idempotency-key'], 'LD-4471-fund-1')

  assert.equal(transfer.status, 'PENDING')
  assert.equal(transfer.amount.minor, 34_416_200)
})

test('an unknown transfer status is never treated as settled', async () => {
  // Reading an unrecognised status as success would release a seller's money
  // against a transfer that never completed.
  const { impl } = stubFetch({
    body: { id: 'txn_1', status: 'SOMETHING_NEW', amount: '10.00', currency: 'USD' },
  })
  const client = new WeWireClient({ ...base, fetchImpl: impl })
  const transfer = await client.getTransaction({ transactionId: 'txn_1' })
  assert.equal(transfer.status, 'PENDING')
})

test('surfaces provider errors with code and retryability', async () => {
  const { impl } = stubFetch({
    status: 401,
    body: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid API key' },
  })
  const client = new WeWireClient({ ...base, fetchImpl: impl })

  await assert.rejects(
    () => client.getRate({ from: 'USD', to: 'GHS' }),
    (error: unknown) => {
      assert.ok(error instanceof ProviderError)
      assert.equal(error.status, 401)
      assert.equal(error.code, 'AUTH_INVALID_CREDENTIALS')
      assert.equal(error.retryable, false, 'a bad key must not be retried')
      return true
    },
  )
})

test('treats 5xx and 429 as retryable', () => {
  assert.equal(new ProviderError('x', { status: 500, code: 'X' }).retryable, true)
  assert.equal(new ProviderError('x', { status: 429, code: 'X' }).retryable, true)
  assert.equal(new ProviderError('x', { status: 422, code: 'X' }).retryable, false)
})

test('a transport failure is retryable rather than a silent success', async () => {
  const impl: typeof fetch = async () => {
    throw new TypeError('network down')
  }
  const client = new WeWireClient({ ...base, fetchImpl: impl })
  await assert.rejects(
    () => client.getRate({ from: 'USD', to: 'GHS' }),
    (error: unknown) => {
      assert.ok(error instanceof ProviderError)
      assert.equal(error.code, 'PROVIDER_UNREACHABLE')
      assert.equal(error.retryable, true)
      return true
    },
  )
})

test('parses a rate into an exactly replayable integer', () => {
  const quote = toRateQuote('USD', 'GHS', { rate: '12.2', quoteId: 'q_1' })
  assert.equal(quote.scaledRate, 12_200_000)
  assert.equal(quote.scale, 6)

  // Excess precision truncates rather than throwing — the provider is the
  // authority on the rate, and we keep six decimals of it.
  assert.equal(toRateQuote('USD', 'GHS', { rate: '12.23456789' }).scaledRate, 12_234_567)
  assert.throws(() => toRateQuote('USD', 'GHS', { rate: 'not-a-rate' }), ProviderError)
})

test('the mock replays an idempotency key instead of charging twice', async () => {
  const provider = new MockEscrowProvider()
  const request = {
    idempotencyKey: 'LD-4471-fund-1',
    amount: parseMoney('GHS', '344162.00'),
    channel: 'BANK' as const,
    accountCode: 'GCB',
    accountNumber: '1234567890',
    accountName: 'Mensah Auto Ltd',
  }

  const first = await provider.collect(request)
  const second = await provider.collect(request)
  assert.equal(first.id, second.id, 'a replayed key must return the original transfer')

  const other = await provider.collect({ ...request, idempotencyKey: 'LD-4471-fund-2' })
  assert.notEqual(other.id, first.id)
})

test('the mock refuses a non-positive collection', async () => {
  const provider = new MockEscrowProvider()
  await assert.rejects(
    () =>
      provider.collect({
        idempotencyKey: 'k',
        amount: parseMoney('GHS', '0.00'),
        channel: 'BANK',
        accountCode: 'GCB',
        accountNumber: '1234567890',
        accountName: 'x',
      }),
    ProviderError,
  )
})
