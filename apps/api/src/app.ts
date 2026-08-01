import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import type { PrismaClient } from '@prisma/client'
import { registerErrorHandler } from './http/errors.ts'
import { registerAuthRoutes } from './routes/auth.ts'
import { registerDealRoutes } from './routes/deals.ts'
import { registerWebhookRoutes } from './routes/webhooks.ts'
import { registerDocumentRoutes } from './routes/documents.ts'
import { DealService } from './domain/deals.ts'
import { WeWireClient } from './wewire/client.ts'
import { MockEscrowProvider } from './wewire/mock.ts'
import type { EscrowProvider } from './wewire/provider.ts'
import { DiskStorage, MAX_DOCUMENT_BYTES, type Storage } from './storage/storage.ts'
import { S3Storage } from './storage/s3.ts'
import { LogSmsSender, TwilioSmsSender, type SmsSender } from './sms/sender.ts'
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

export function createStorage(env: Env): Storage {
  if (env.STORAGE_DRIVER === 's3') {
    return new S3Storage({
      bucket: env.S3_BUCKET!,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    })
  }
  return new DiskStorage(env.STORAGE_DISK_ROOT)
}

export function createSmsSender(env: Env): SmsSender {
  if (env.OTP_DELIVERY === 'twilio') {
    return new TwilioSmsSender({
      accountSid: env.TWILIO_ACCOUNT_SID!,
      authToken: env.TWILIO_AUTH_TOKEN!,
      from: env.TWILIO_FROM!,
    })
  }
  return new LogSmsSender()
}

export async function buildApp({
  env,
  prisma,
  provider = createProvider(env),
  storage = createStorage(env),
  sms = createSmsSender(env),
}: {
  env: Env
  prisma: PrismaClient
  provider?: EscrowProvider
  storage?: Storage
  sms?: SmsSender
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

  await app.register(multipart, {
    limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
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
    storage: storage.kind,
    sms: sms.name,
  }))

  registerAuthRoutes(app, { prisma, env, sms })
  registerDealRoutes(app, { deals, env })
  registerDocumentRoutes(app, { prisma, storage, env })
  registerWebhookRoutes(app, { prisma, deals, env })

  return app
}
