import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import type { PrismaClient } from '@prisma/client'
import { registerErrorHandler } from './http/errors.ts'
import { registerAuthRoutes } from './routes/auth.ts'
import { registerDealRoutes } from './routes/deals.ts'
import { registerWebhookRoutes } from './routes/webhooks.ts'
import { DealService } from './domain/deals.ts'
import { WeWireClient } from './wewire/client.ts'
import { MockEscrowProvider } from './wewire/mock.ts'
import type { EscrowProvider } from './wewire/provider.ts'
import type { Env } from './env.ts'

declare module 'fastify' {
  interface FastifyRequest {
    /** Raw body, kept for webhook signature verification. */
    rawBody?: string
  }
}

export function createProvider(env: Env): EscrowProvider {
  if (env.ESCROW_PROVIDER === 'wewire') {
    const config = env.wewire!
    return new WeWireClient({ apiKey: config.apiKey, baseUrl: config.baseUrl })
  }
  return new MockEscrowProvider()
}

export async function buildApp({
  env,
  prisma,
  provider = createProvider(env),
}: {
  env: Env
  prisma: PrismaClient
  provider?: EscrowProvider
}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.NODE_ENV === 'test' ? 'silent' : 'info' },
    // Traders sit behind mobile networks; be explicit rather than default.
    requestTimeout: 30_000,
  })

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  })

  /**
   * Keep the raw JSON body around. Webhook signatures are computed over the
   * exact bytes, and re-serialising the parsed object never matches.
   */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request, body, done) => {
      request.rawBody = body as string
      try {
        done(null, body === '' ? undefined : JSON.parse(body as string))
      } catch (error) {
        done(error as Error, undefined)
      }
    },
  )

  registerErrorHandler(app)

  const deals = new DealService({
    prisma,
    provider,
    escrowSubCustomerId: env.wewire?.escrowSubCustomerId ?? 'mock-subcustomer',
  })

  app.get('/health', async () => ({
    status: 'ok',
    provider: provider.name,
  }))

  registerAuthRoutes(app, { prisma, env })
  registerDealRoutes(app, { deals, env })
  registerWebhookRoutes(app, { prisma, deals, env })

  return app
}
