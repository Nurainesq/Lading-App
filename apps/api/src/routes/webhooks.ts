import type { FastifyInstance } from 'fastify'
import { parseMoney, type Currency } from '@lading/shared'
import type { PrismaClient } from '@prisma/client'
import { parseEnvelope, verifyWebhook } from '../wewire/webhooks.ts'
import type { DealService } from '../domain/deals.ts'
import type { Env } from '../env.ts'

/**
 * Provider callbacks.
 *
 * This is the only path by which a deal becomes FUNDED — a client call cannot
 * prove money moved. Every delivery is verified, then recorded before it is
 * acted on, so an at-least-once redelivery is a no-op rather than a second
 * payout.
 */

interface CollectionData {
  id?: string
  transactionId?: string
  reference?: string
  amount?: string | number
  currency?: string
  status?: string
}

export function registerWebhookRoutes(
  app: FastifyInstance,
  { prisma, deals, env }: { prisma: PrismaClient; deals: DealService; env: Env },
): void {
  app.post('/v1/webhooks/wewire', async (request, reply) => {
    const secret = env.webhookSecret
    if (!secret) {
      // Refuse rather than accept unverified callbacks when running on the
      // in-memory provider: an open endpoint here could fund deals for free.
      request.log.warn('rejected a webhook: no WEWIRE_WEBHOOK_SECRET configured')
      return reply.status(503).send({ error: { code: 'NOT_CONFIGURED', message: 'Not configured' } })
    }

    // The exact bytes as received — re-serialising the parsed JSON would
    // change key order and break the signature.
    const rawBody = (request.rawBody ?? '') as string

    verifyWebhook({
      headers: request.headers as Record<string, string>,
      rawBody,
      secret,
    })

    const envelope = parseEnvelope(rawBody)
    const deliveryId = String(request.headers['webhook-id'])

    // Idempotency: the unique constraint means a redelivery loses the race
    // and is acknowledged without being processed twice.
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: 'wewire',
          externalId: deliveryId,
          type: envelope.eventType,
          payload: envelope.data as never,
          signatureOk: true,
        },
      })
    } catch {
      request.log.info({ deliveryId }, 'ignored a duplicate webhook delivery')
      return reply.status(200).send({ status: 'duplicate' })
    }

    try {
      await handle(envelope.eventType, envelope.data as CollectionData, deals)
      await prisma.webhookEvent.updateMany({
        where: { provider: 'wewire', externalId: deliveryId },
        data: { processedAt: new Date() },
      })
    } catch (error) {
      await prisma.webhookEvent.updateMany({
        where: { provider: 'wewire', externalId: deliveryId },
        data: { error: error instanceof Error ? error.message : String(error) },
      })
      // Signal failure so the provider retries.
      throw error
    }

    return reply.status(200).send({ status: 'ok' })
  })
}

async function handle(
  eventType: string,
  data: CollectionData,
  deals: DealService,
): Promise<void> {
  switch (eventType) {
    case 'collection.completed':
    case 'transaction.pay_in': {
      const reference = data.reference
      const currency = data.currency as Currency | undefined
      if (!reference || !currency || data.amount === undefined) return
      await deals.markFunded({
        reference,
        providerTransactionId: data.id ?? data.transactionId ?? reference,
        amount: parseMoney(currency, String(data.amount)),
      })
      return
    }

    // Failures and disbursement updates are recorded by the WebhookEvent row
    // above; acting on them is a follow-up, not something to fake here.
    case 'collection.failed':
    case 'disbursement.completed':
    case 'disbursement.failed':
    case 'virtual_account.status_updated':
    case 'subcustomer.kyc_status_updated':
      return

    default:
      return
  }
}
