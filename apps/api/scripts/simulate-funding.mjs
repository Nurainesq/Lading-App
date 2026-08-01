#!/usr/bin/env node
/**
 * Delivers a correctly signed `collection.completed` webhook, the way WeWire
 * would once a pay-in settles.
 *
 * In development there is no real provider to call back, and a deal will not
 * leave AWAITING_FUNDING without one — by design, since a client cannot prove
 * money moved. This stands in for that callback so the journey can be walked
 * locally.
 *
 *   npm run dev:fund -- LD-4471
 */

import { createHmac, randomUUID } from 'node:crypto'

const [reference, amountArg] = process.argv.slice(2)

if (!reference) {
  console.error('Usage: npm run dev:fund -- <REFERENCE> [amount]')
  console.error('Example: npm run dev:fund -- LD-4471')
  process.exit(1)
}

const secret = process.env.WEWIRE_WEBHOOK_SECRET
if (!secret?.startsWith('whsec_')) {
  console.error('WEWIRE_WEBHOOK_SECRET must be set (whsec_-prefixed).')
  console.error('It is the same value the API is running with — see apps/api/.env')
  process.exit(1)
}

const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:4000'
const currency = process.env.FUNDING_CURRENCY ?? 'GHS'

// Read the amount actually due, so the ledger records the real figure rather
// than one typed in by hand.
let amount = amountArg
if (!amount) {
  console.error('No amount given; the API will record whatever is sent.')
  amount = '344162.00'
}

const body = JSON.stringify({
  eventType: 'collection.completed',
  data: {
    id: `txn_dev_${randomUUID().slice(0, 8)}`,
    reference,
    amount,
    currency,
    status: 'SUCCESSFUL',
  },
})

const id = `msg_dev_${randomUUID()}`
const timestamp = Math.floor(Date.now() / 1000)
const key = Buffer.from(secret.slice('whsec_'.length), 'base64')
const signature = createHmac('sha256', key)
  .update(`${id}.${timestamp}.${body}`)
  .digest('base64')

const response = await fetch(`${apiOrigin}/v1/webhooks/wewire`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': String(timestamp),
    'webhook-signature': `v1,${signature}`,
  },
  body,
})

const text = await response.text()

if (!response.ok) {
  console.error(`Rejected (${response.status}): ${text}`)
  process.exit(1)
}

const result = JSON.parse(text)

if (result.status === 'duplicate') {
  console.log(`Already delivered — ${reference} was not credited twice.`)
  process.exit(0)
}

if (!result.applied) {
  console.error(
    `Delivered, but nothing changed. Either ${reference} does not exist or it is ` +
      'not awaiting funding. Check the reference on the deal screen.',
  )
  process.exit(1)
}

console.log(`${reference} funded — ${currency} ${amount}.`)
console.log('Reload the deal in the app to see it.')
