import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.ts'
import { loadEnv } from './env.ts'
import { MockEscrowProvider } from './wewire/mock.ts'
import { signWebhook } from './wewire/webhooks.ts'

/**
 * The complete LD-#### journey, driven through the HTTP API against a real
 * Postgres and the in-memory escrow provider.
 *
 * Needs DATABASE_URL. Skipped when absent so the unit suite still runs on a
 * machine without a database.
 */

const DATABASE_URL = process.env.DATABASE_URL
const WEBHOOK_SECRET = `whsec_${Buffer.from('journey-test-signing-key-padding!').toString('base64')}`

describe('the full deal journey', { skip: DATABASE_URL ? false : 'DATABASE_URL not set' }, () => {
  let app: FastifyInstance
  let prisma: PrismaClient
  let provider: MockEscrowProvider

  before(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
    // Order matters: children before parents.
    await prisma.$executeRawUnsafe(
      'TRUNCATE "WebhookEvent","LedgerEntry","TimelineEvent","Discrepancy","DocumentCheck","Document","RateLock","EscrowAccount","Deal","OtpChallenge","User","Business" CASCADE',
    )

    const env = loadEnv({
      NODE_ENV: 'test',
      DATABASE_URL,
      JWT_SECRET: 'a-test-secret-that-is-long-enough-to-pass',
      ESCROW_PROVIDER: 'mock',
      WEB_ORIGIN: 'http://localhost:5173',
    } as NodeJS.ProcessEnv)

    // The webhook route needs a secret even on the mock provider; without one
    // it refuses deliveries outright, which is the behaviour we want in prod.
    env.webhookSecret = WEBHOOK_SECRET

    provider = new MockEscrowProvider()
    app = await buildApp({ env, prisma, provider })
    await app.ready()
  })

  after(async () => {
    await app?.close()
    await prisma?.$disconnect()
  })

  /** Signs in and returns a bearer token. */
  async function signIn(phone: string): Promise<string> {
    const requested = await app.inject({
      method: 'POST',
      url: '/v1/auth/otp',
      payload: { phone },
    })
    assert.equal(requested.statusCode, 202)

    // The code is only ever stored hashed, so drive verification the way the
    // trader does — by reading what was actually issued.
    const challenge = await prisma.otpChallenge.findFirstOrThrow({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    })
    // Recover the code by brute force over the 6-digit space is impractical;
    // instead the test re-hashes candidates only for the code it knows was
    // logged. Simpler: replace the hash with a known code.
    const { createHash } = await import('node:crypto')
    const code = '424242'
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { codeHash: createHash('sha256').update(`${phone}:${code}`).digest('hex') },
    })

    const verified = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify',
      payload: { phone, code },
    })
    assert.equal(verified.statusCode, 200, verified.body)
    return verified.json().token as string
  }

  function auth(token: string) {
    return { authorization: `Bearer ${token}` }
  }

  async function createDeal(token: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/deals',
      headers: auth(token),
      payload: {
        side: 'BUYING',
        counterpartyName: 'Al Habib Auto Parts LLC',
        counterpartyCountry: 'AE',
        counterpartyContact: '+971504482210',
        goods: 'Toyota & Nissan spare parts',
        value: '28000.00',
        currency: 'USD',
        fundingCurrency: 'GHS',
        settlementCurrency: 'AED',
        releaseCondition: 'VERIFIED_BILL_OF_LADING',
        portOfLoading: 'Jebel Ali',
        portOfDischarge: 'Tema',
      },
    })
    assert.equal(response.statusCode, 201, response.body)
    return response.json()
  }

  /** Delivers a correctly signed provider webhook. */
  async function deliverWebhook(eventType: string, data: unknown, deliveryId: string) {
    const body = JSON.stringify({ eventType, data })
    const timestamp = Math.floor(Date.now() / 1000)
    return app.inject({
      method: 'POST',
      url: '/v1/webhooks/wewire',
      headers: {
        'content-type': 'application/json',
        'webhook-id': deliveryId,
        'webhook-timestamp': String(timestamp),
        'webhook-signature': signWebhook({
          id: deliveryId,
          timestamp,
          body,
          secret: WEBHOOK_SECRET,
        }),
      },
      payload: body,
    })
  }

  test('runs draft through to released', async () => {
    const buyer = await signIn('+233244000001')

    // --- write the deal -----------------------------------------------
    const draft = await createDeal(buyer)
    assert.equal(draft.status, 'DRAFT')
    assert.match(draft.reference, /^LD-\d{4,5}$/)
    assert.equal(draft.value.display, '28,000.00')
    assert.equal(draft.escrowAccount, null, 'no account exists before acceptance')

    // --- send to the seller -------------------------------------------
    const sent = await app.inject({
      method: 'POST',
      url: `/v1/deals/${draft.id}/send`,
      headers: auth(buyer),
    })
    assert.equal(sent.statusCode, 200, sent.body)
    const inviteUrl = sent.json().inviteUrl as string
    const inviteToken = inviteUrl.split('/invite/')[1]!
    assert.equal(sent.json().deal.status, 'AWAITING_ACCEPTANCE')

    // --- the seller accepts, with no account of their own --------------
    const accepted = await app.inject({
      method: 'POST',
      url: `/v1/invites/${inviteToken}/accept`,
    })
    assert.equal(accepted.statusCode, 200, accepted.body)
    const afterAccept = accepted.json()
    assert.equal(afterAccept.status, 'AWAITING_FUNDING')

    // The escrow account is issued at acceptance — one account, this deal only.
    assert.ok(afterAccept.escrowAccount, 'an escrow account is issued on acceptance')
    assert.equal(afterAccept.escrowAccount.status, 'ACTIVE')
    assert.equal(afterAccept.escrowAccount.currency, 'GHS')

    // The rate is locked and the figures derived once, not recomputed later.
    assert.equal(afterAccept.totalDue.currency, 'GHS')
    assert.equal(afterAccept.totalDue.display, '344,162.00')
    assert.equal(afterAccept.fee.display, '2,562.00')
    assert.equal(afterAccept.settlementAmount.currency, 'AED')
    assert.equal(afterAccept.settlementAmount.display, '102,844.00')
    assert.ok(afterAccept.rateLockedAt)

    // The invite is single-use.
    const replayed = await app.inject({
      method: 'POST',
      url: `/v1/invites/${inviteToken}/accept`,
    })
    assert.equal(replayed.statusCode, 404, 'an invite cannot be accepted twice')

    // --- fund ----------------------------------------------------------
    const funded = await app.inject({
      method: 'POST',
      url: `/v1/deals/${draft.id}/fund`,
      headers: auth(buyer),
      payload: { source: 'BANK', bankCode: 'GCB', accountNumber: '1234567890' },
    })
    assert.equal(funded.statusCode, 200, funded.body)
    assert.equal(funded.json().status, 'PENDING')

    // Critically: initiating a pay-in does NOT fund the deal. Only a
    // confirmed provider callback can, because a client call cannot prove
    // money moved.
    assert.equal(
      funded.json().deal.status,
      'AWAITING_FUNDING',
      'the deal must not be funded by the client call alone',
    )

    // --- the provider confirms -----------------------------------------
    const confirmation = await deliverWebhook(
      'collection.completed',
      {
        id: 'txn_journey_1',
        reference: draft.reference,
        amount: '344162.00',
        currency: 'GHS',
        status: 'SUCCESSFUL',
      },
      'msg_journey_1',
    )
    assert.equal(confirmation.statusCode, 200, confirmation.body)

    const afterFunding = await app.inject({
      method: 'GET',
      url: `/v1/deals/${draft.id}`,
      headers: auth(buyer),
    })
    assert.equal(afterFunding.json().status, 'FUNDED')
    assert.ok(afterFunding.json().fundedAt)

    // A redelivery must not credit the ledger twice.
    const redelivery = await deliverWebhook(
      'collection.completed',
      { id: 'txn_journey_1', reference: draft.reference, amount: '344162.00', currency: 'GHS' },
      'msg_journey_1',
    )
    assert.equal(redelivery.statusCode, 200)
    assert.equal(redelivery.json().status, 'duplicate')

    const credits = await prisma.ledgerEntry.count({
      where: { dealId: draft.id, kind: 'funding' },
    })
    assert.equal(credits, 1, 'a redelivered webhook must not double-credit')

    // --- the voyage ------------------------------------------------------
    const shipped = await app.inject({
      method: 'POST',
      url: `/v1/deals/${draft.id}/shipment`,
      headers: auth(buyer),
      payload: { detail: 'MSC AMSTERDAM' },
    })
    assert.equal(shipped.statusCode, 200, shipped.body)
    assert.equal(shipped.json().status, 'IN_TRANSIT')

    // --- documents -------------------------------------------------------
    const document = await prisma.document.create({
      data: {
        dealId: draft.id,
        kind: 'BILL_OF_LADING',
        filename: 'MSCU-2249173.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1_258_291,
        storageKey: `deals/${draft.id}/bl.pdf`,
        sha256: 'a'.repeat(64),
      },
    })

    const presented = await app.inject({
      method: 'POST',
      url: `/v1/deals/${draft.id}/documents/present`,
      headers: auth(buyer),
      payload: { documentIds: [document.id] },
    })
    assert.equal(presented.statusCode, 200, presented.body)
    assert.equal(presented.json().status, 'DOCUMENTS_PRESENTED')

    // --- release ----------------------------------------------------------
    const released = await app.inject({
      method: 'POST',
      url: `/v1/deals/${draft.id}/release`,
      headers: auth(buyer),
    })
    assert.equal(released.statusCode, 200, released.body)
    const final = released.json()
    assert.equal(final.status, 'RELEASED')
    assert.ok(final.releasedAt)
    assert.equal(final.escrowAccount.status, 'CLOSED', 'the account closes when the deal settles')

    const debit = await prisma.ledgerEntry.findFirstOrThrow({
      where: { dealId: draft.id, kind: 'release' },
    })
    assert.equal(debit.currency, 'AED')
    assert.equal(Number(debit.amountMinor), 10_284_400)

    // The timeline is a byproduct of the transitions, not written by hand.
    const labels = final.timeline.map((t: { label: string }) => t.label)
    assert.deepEqual(labels, [
      'Deal drafted',
      'Sent to counterparty',
      'Counterparty accepted',
      'Escrow account issued',
      'Funding initiated',
      'Escrow funded',
      'Seller confirmed shipment',
      'Documents presented',
      'Funds released',
    ])
  })

  test('an open discrepancy freezes the money', async () => {
    const buyer = await signIn('+233244000002')
    const deal = await createDeal(buyer)

    const sent = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/send`,
      headers: auth(buyer),
    })
    const token = (sent.json().inviteUrl as string).split('/invite/')[1]!
    await app.inject({ method: 'POST', url: `/v1/invites/${token}/accept` })
    await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/fund`,
      headers: auth(buyer),
      payload: { source: 'MOBILE_MONEY', network: 'MTN', msisdn: '0244123456' },
    })

    await deliverWebhook(
      'collection.completed',
      { id: 'txn_journey_2', reference: deal.reference, amount: '344162.00', currency: 'GHS' },
      'msg_journey_2',
    )

    const document = await prisma.document.create({
      data: {
        dealId: deal.id,
        kind: 'BILL_OF_LADING',
        filename: 'short-shipment.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
        storageKey: `deals/${deal.id}/bl.pdf`,
        sha256: 'b'.repeat(64),
      },
    })
    await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/documents/present`,
      headers: auth(buyer),
      payload: { documentIds: [document.id] },
    })

    const raised = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/discrepancy`,
      headers: auth(buyer),
      payload: { reason: 'QUANTITY_SHORT', note: 'Only 60% of the order shipped' },
    })
    assert.equal(raised.statusCode, 200, raised.body)
    assert.equal(raised.json().status, 'DISCREPANCY')

    // The promise on the screen: nobody moves the money while this is open.
    const attempted = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/release`,
      headers: auth(buyer),
    })
    assert.equal(attempted.statusCode, 409, 'release must be refused during a discrepancy')
    assert.equal(attempted.json().error.code, 'ILLEGAL_TRANSITION')

    // And no payout was attempted behind the refusal.
    const debits = await prisma.ledgerEntry.count({
      where: { dealId: deal.id, kind: 'release' },
    })
    assert.equal(debits, 0)

    // The one way out: an explicitly stated resolution.
    const resolved = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/discrepancy/resolve`,
      headers: auth(buyer),
      payload: { outcome: 'RELEASE', note: 'Agreed partial settlement' },
    })
    assert.equal(resolved.statusCode, 200, resolved.body)
    assert.equal(resolved.json().status, 'RELEASED')

    const settledDebits = await prisma.ledgerEntry.count({
      where: { dealId: deal.id, kind: 'release' },
    })
    assert.equal(settledDebits, 1, 'resolution pays out exactly once')

    const openDiscrepancies = await prisma.discrepancy.count({
      where: { dealId: deal.id, resolvedAt: null },
    })
    assert.equal(openDiscrepancies, 0)
  })

  test('a funding call with the wrong code set is rejected', async () => {
    const buyer = await signIn('+233244000006')
    const deal = await createDeal(buyer)
    const sent = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/send`,
      headers: auth(buyer),
    })
    const token = (sent.json().inviteUrl as string).split('/invite/')[1]!
    await app.inject({ method: 'POST', url: `/v1/invites/${token}/accept` })

    // A bank code is not a mobile network. Sending one as the other would put
    // the wrong accountCode on a real collection.
    const wrong = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/fund`,
      headers: auth(buyer),
      payload: { source: 'MOBILE_MONEY', network: 'GCB', msisdn: '0244123456' },
    })
    assert.equal(wrong.statusCode, 422)

    const short = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/fund`,
      headers: auth(buyer),
      payload: { source: 'MOBILE_MONEY', network: 'MTN', msisdn: '244' },
    })
    assert.equal(short.statusCode, 422, 'a malformed mobile money number is refused')
  })

  test('a deal is invisible to another business', async () => {
    const buyer = await signIn('+233244000003')
    const stranger = await signIn('+233244000004')
    const deal = await createDeal(buyer)

    const probe = await app.inject({
      method: 'GET',
      url: `/v1/deals/${deal.id}`,
      headers: auth(stranger),
    })
    // 404 rather than 403 — whether a deal exists is itself private.
    assert.equal(probe.statusCode, 404)

    const unauthenticated = await app.inject({ method: 'GET', url: `/v1/deals/${deal.id}` })
    assert.equal(unauthenticated.statusCode, 401)
  })

  test('an unsigned webhook cannot fund a deal', async () => {
    const buyer = await signIn('+233244000005')
    const deal = await createDeal(buyer)
    const sent = await app.inject({
      method: 'POST',
      url: `/v1/deals/${deal.id}/send`,
      headers: auth(buyer),
    })
    const token = (sent.json().inviteUrl as string).split('/invite/')[1]!
    await app.inject({ method: 'POST', url: `/v1/invites/${token}/accept` })

    const forged = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/wewire',
      headers: {
        'content-type': 'application/json',
        'webhook-id': 'msg_forged',
        'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
        'webhook-signature': 'v1,Zm9yZ2Vk',
      },
      payload: JSON.stringify({
        eventType: 'collection.completed',
        data: { id: 'txn_forged', reference: deal.reference, amount: '344162.00', currency: 'GHS' },
      }),
    })
    assert.equal(forged.statusCode, 400)

    const after = await app.inject({
      method: 'GET',
      url: `/v1/deals/${deal.id}`,
      headers: auth(buyer),
    })
    assert.equal(
      after.json().status,
      'AWAITING_FUNDING',
      'a forged webhook must never mark a deal funded',
    )
  })
})
