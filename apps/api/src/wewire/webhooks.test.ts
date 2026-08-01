import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REPLAY_TOLERANCE_SECONDS,
  WebhookVerificationError,
  parseEnvelope,
  signWebhook,
  verifyWebhook,
} from './webhooks.ts'

const secret = `whsec_${Buffer.from('a-test-signing-key-of-some-length').toString('base64')}`
const id = 'msg_2abc'
const body = JSON.stringify({ eventType: 'collection.completed', data: { id: 'txn_1' } })

function headersFor(timestamp: number, overrides: Record<string, string> = {}) {
  return {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': signWebhook({ id, timestamp, body, secret }),
    ...overrides,
  }
}

test('accepts a correctly signed delivery', () => {
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  assert.doesNotThrow(() => verifyWebhook({ headers: headersFor(timestamp), rawBody: body, secret, now }))
})

test('rejects a tampered body', () => {
  // The attack that matters: flipping a deal to funded without paying.
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const tampered = JSON.stringify({ eventType: 'collection.completed', data: { id: 'txn_evil' } })
  assert.throws(
    () => verifyWebhook({ headers: headersFor(timestamp), rawBody: tampered, secret, now }),
    WebhookVerificationError,
  )
})

test('rejects a signature made with the wrong secret', () => {
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const otherSecret = `whsec_${Buffer.from('a-completely-different-key-here!!').toString('base64')}`
  const headers = {
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': signWebhook({ id, timestamp, body, secret: otherSecret }),
  }
  assert.throws(() => verifyWebhook({ headers, rawBody: body, secret, now }), WebhookVerificationError)
})

test('rejects a replayed delivery outside the window', () => {
  const now = new Date()
  const stale = Math.floor(now.getTime() / 1000) - REPLAY_TOLERANCE_SECONDS - 1
  assert.throws(
    () => verifyWebhook({ headers: headersFor(stale), rawBody: body, secret, now }),
    /replay window/,
  )
})

test('accepts a delivery just inside the window', () => {
  const now = new Date()
  const recent = Math.floor(now.getTime() / 1000) - (REPLAY_TOLERANCE_SECONDS - 5)
  assert.doesNotThrow(() =>
    verifyWebhook({ headers: headersFor(recent), rawBody: body, secret, now }),
  )
})

test('rejects a future timestamp beyond tolerance', () => {
  const now = new Date()
  const future = Math.floor(now.getTime() / 1000) + REPLAY_TOLERANCE_SECONDS + 60
  assert.throws(
    () => verifyWebhook({ headers: headersFor(future), rawBody: body, secret, now }),
    /replay window/,
  )
})

test('rejects missing headers', () => {
  const now = new Date()
  assert.throws(
    () => verifyWebhook({ headers: {}, rawBody: body, secret, now }),
    /Missing webhook-id/,
  )
})

test('rejects a signature that is not v1', () => {
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const headers = headersFor(timestamp, { 'webhook-signature': 'v2,abcdef' })
  assert.throws(() => verifyWebhook({ headers, rawBody: body, secret, now }), /No v1 signature/)
})

test('accepts when one of several rotated signatures matches', () => {
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const good = signWebhook({ id, timestamp, body, secret })
  const headers = headersFor(timestamp, { 'webhook-signature': `v1,ZmFrZQ== ${good}` })
  assert.doesNotThrow(() => verifyWebhook({ headers, rawBody: body, secret, now }))
})

test('re-serialising the body breaks verification, as documented', () => {
  // Guards the reason routes must keep the raw buffer rather than the parsed
  // object: JSON.stringify(JSON.parse(body)) is not byte-identical.
  const now = new Date()
  const timestamp = Math.floor(now.getTime() / 1000)
  const spaced = JSON.stringify(JSON.parse(body), null, 2)
  assert.throws(
    () => verifyWebhook({ headers: headersFor(timestamp), rawBody: spaced, secret, now }),
    WebhookVerificationError,
  )
})

test('parses the event envelope', () => {
  assert.deepEqual(parseEnvelope(body), {
    eventType: 'collection.completed',
    data: { id: 'txn_1' },
  })
  assert.throws(() => parseEnvelope('{'), /not valid JSON/)
  assert.throws(() => parseEnvelope('{"data":{}}'), /missing eventType/)
})
