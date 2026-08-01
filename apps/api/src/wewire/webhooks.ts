import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Standard Webhooks signature verification for WeWire deliveries.
 *
 * A forged webhook would be able to mark a deal funded — that is, to make the
 * seller ship against money that was never paid. So verification failure is
 * always a rejection, never a warning, and every comparison is constant-time.
 */

export interface WebhookHeaders {
  'webhook-id'?: string
  'webhook-timestamp'?: string
  'webhook-signature'?: string
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookVerificationError'
  }
}

/** Deliveries older than this are refused, so a captured payload cannot be replayed. */
export const REPLAY_TOLERANCE_SECONDS = 5 * 60

function decodeSecret(secret: string): Buffer {
  if (!secret.startsWith('whsec_')) {
    throw new WebhookVerificationError('Webhook secret must start with whsec_')
  }
  return Buffer.from(secret.slice('whsec_'.length), 'base64')
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Verifies a delivery.
 *
 * `rawBody` must be the exact bytes received. Re-serialising the parsed JSON
 * changes key order and whitespace, and the signature will never match.
 */
export function verifyWebhook({
  headers,
  rawBody,
  secret,
  now = new Date(),
}: {
  headers: WebhookHeaders
  rawBody: string | Buffer
  secret: string
  now?: Date
}): void {
  const id = headers['webhook-id']
  const timestamp = headers['webhook-timestamp']
  const signatureHeader = headers['webhook-signature']

  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookVerificationError('Missing webhook-id, webhook-timestamp or webhook-signature')
  }

  const sentAt = Number(timestamp)
  if (!Number.isFinite(sentAt)) {
    throw new WebhookVerificationError('webhook-timestamp is not a unix timestamp')
  }

  const driftSeconds = Math.abs(Math.floor(now.getTime() / 1000) - sentAt)
  if (driftSeconds > REPLAY_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError(
      `webhook-timestamp is ${driftSeconds}s away from now; outside the replay window`,
    )
  }

  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8')
  const signedContent = `${id}.${timestamp}.${body}`
  const expected = createHmac('sha256', decodeSecret(secret)).update(signedContent).digest('base64')

  // The header carries space-separated `v1,<signature>` pairs so keys can be
  // rotated with both old and new signatures in flight.
  const candidates = signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice('v1,'.length))

  if (candidates.length === 0) {
    throw new WebhookVerificationError('No v1 signature present')
  }

  const matched = candidates.some((candidate) => constantTimeEquals(candidate, expected))
  if (!matched) {
    throw new WebhookVerificationError('Signature does not match')
  }
}

/** Signs a payload the way WeWire does. Used by the tests and the mock provider. */
export function signWebhook({
  id,
  timestamp,
  body,
  secret,
}: {
  id: string
  timestamp: number
  body: string
  secret: string
}): string {
  const signature = createHmac('sha256', decodeSecret(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  return `v1,${signature}`
}

export interface WeWireWebhookEnvelope<T = unknown> {
  eventType: string
  data: T
}

export function parseEnvelope(rawBody: string): WeWireWebhookEnvelope {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new WebhookVerificationError('Body is not valid JSON')
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { eventType?: unknown }).eventType !== 'string'
  ) {
    throw new WebhookVerificationError('Body is missing eventType')
  }
  return parsed as WeWireWebhookEnvelope
}
