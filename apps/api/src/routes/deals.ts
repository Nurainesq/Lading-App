import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  createDealSchema,
  fundDealSchema,
  presentDocumentsSchema,
  raiseDiscrepancySchema,
  resolveDiscrepancySchema,
} from '@lading/shared'
import { requireSession } from '../http/session.ts'
import type { DealService } from '../domain/deals.ts'
import type { Env } from '../env.ts'

const idParam = z.object({ id: z.string().uuid() })
const tokenParam = z.object({ token: z.string().min(16) })

export function registerDealRoutes(
  app: FastifyInstance,
  { deals, env }: { deals: DealService; env: Env },
): void {
  const session = (request: Parameters<typeof requireSession>[0]) =>
    requireSession(request, env.JWT_SECRET)

  app.get('/v1/deals', async (request) => {
    const { businessId } = await session(request)
    return { deals: await deals.list(businessId) }
  })

  app.post('/v1/deals', async (request, reply) => {
    const { businessId } = await session(request)
    const input = createDealSchema.parse(request.body)
    const deal = await deals.create({ businessId, ...input })
    return reply.status(201).send(await deals.serialise(deal.id))
  })

  app.get('/v1/deals/:id', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    return deals.get(id, businessId)
  })

  app.post('/v1/deals/:id/send', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const deal = await deals.send(id, businessId)
    return {
      deal: await deals.serialise(deal.id),
      // The counterparty needs no account — only this link.
      inviteUrl: `${env.WEB_ORIGIN}/invite/${deal.inviteToken}`,
    }
  })

  /**
   * Accepting is deliberately unauthenticated: the seller arrives from a link
   * with no account. The single-use token is the authorisation.
   */
  app.post('/v1/invites/:token/accept', async (request) => {
    const { token } = tokenParam.parse(request.params)
    const deal = await deals.accept(token)
    return deals.serialise(deal.id)
  })

  app.post('/v1/deals/:id/fund', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const input = fundDealSchema.parse(request.body)
    const { transfer, totalDue } = await deals.fund(id, businessId, input)
    return {
      // Funding is asynchronous: the deal is not funded until the provider
      // webhook confirms it, so the client is told to wait rather than shown
      // a success it cannot rely on.
      status: transfer.status,
      transactionId: transfer.id,
      totalDue: { currency: totalDue.currency, minor: totalDue.minor },
      deal: await deals.serialise(id),
    }
  })

  app.post('/v1/deals/:id/shipment', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const { detail } = z.object({ detail: z.string().trim().min(1) }).parse(request.body)
    const deal = await deals.confirmShipment(id, businessId, detail)
    return deals.serialise(deal.id)
  })

  app.post('/v1/deals/:id/documents/present', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const { documentIds } = presentDocumentsSchema.parse(request.body)
    const deal = await deals.present(id, businessId, documentIds)
    return deals.serialise(deal.id)
  })

  app.post('/v1/deals/:id/release', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const deal = await deals.release(id, businessId)
    return deals.serialise(deal.id)
  })

  app.post('/v1/deals/:id/discrepancy', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const input = raiseDiscrepancySchema.parse(request.body)
    const deal = await deals.raiseDiscrepancy(id, businessId, input)
    return deals.serialise(deal.id)
  })

  /**
   * Resolving is separate from releasing on purpose: money leaves a frozen
   * escrow only against an explicitly stated outcome.
   */
  app.post('/v1/deals/:id/discrepancy/resolve', async (request) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const input = resolveDiscrepancySchema.parse(request.body)
    const deal = await deals.resolveDiscrepancy(id, businessId, input)
    return deals.serialise(deal.id)
  })
}
