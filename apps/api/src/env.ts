import { z } from 'zod'

/**
 * Configuration, validated at boot. The process refuses to start rather than
 * discovering a missing escrow credential halfway through funding a deal.
 *
 * Secrets only ever arrive through the environment — never a committed file.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /** Signs session tokens. Must be at least 32 bytes of real entropy. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),

  /**
   * Escrow provider. `mock` runs the full journey in-memory so the app is
   * developable without credentials; `wewire` calls the real API.
   */
  ESCROW_PROVIDER: z.enum(['mock', 'wewire']).default('mock'),

  WEWIRE_API_KEY: z.string().optional(),
  WEWIRE_BASE_URL: z.string().url().optional(),
  /** Standard Webhooks secret, `whsec_`-prefixed. */
  WEWIRE_WEBHOOK_SECRET: z.string().optional(),
  /** Lading's own sub-customer, which holds the per-deal escrow accounts. */
  WEWIRE_ESCROW_SUBCUSTOMER_ID: z.string().optional(),

  /** Ghana sandbox has fixed test numbers; keep OTP delivery off there. */
  OTP_DELIVERY: z.enum(['log', 'sms']).default('log'),
})

export type Env = z.infer<typeof schema> & {
  /** Present and non-empty only when ESCROW_PROVIDER is `wewire`. */
  wewire?: {
    apiKey: string
    baseUrl: string
    webhookSecret: string
    escrowSubCustomerId: string
  }
  /**
   * Set whenever a signing secret is configured, independently of which
   * provider is running — so callbacks can be exercised against the mock.
   * Without it the webhook route refuses everything, which is the right
   * default: an unverified endpoint here could fund deals for free.
   */
  webhookSecret?: string
}

const SANDBOX_BASE_URL = 'https://stage-capi.wewireafrica.com'
const PRODUCTION_BASE_URL = 'https://capi.wewire.com'

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment:\n${issues.join('\n')}`)
  }

  const env = parsed.data as Env

  if (env.WEWIRE_WEBHOOK_SECRET) {
    if (!env.WEWIRE_WEBHOOK_SECRET.startsWith('whsec_')) {
      throw new Error('WEWIRE_WEBHOOK_SECRET must start with whsec_')
    }
    env.webhookSecret = env.WEWIRE_WEBHOOK_SECRET
  }

  if (env.ESCROW_PROVIDER === 'wewire') {
    const missing: string[] = []
    if (!env.WEWIRE_API_KEY) missing.push('WEWIRE_API_KEY')
    if (!env.WEWIRE_WEBHOOK_SECRET) missing.push('WEWIRE_WEBHOOK_SECRET')
    if (!env.WEWIRE_ESCROW_SUBCUSTOMER_ID) missing.push('WEWIRE_ESCROW_SUBCUSTOMER_ID')
    if (missing.length > 0) {
      throw new Error(
        `ESCROW_PROVIDER=wewire requires: ${missing.join(', ')}. ` +
          'Get a sandbox key from the WeWire dashboard under Settings → Developers.',
      )
    }

    const apiKey = env.WEWIRE_API_KEY!
    // The key prefix states the environment; trust it over a hand-set URL so a
    // test key can never be pointed at production by a stray config change.
    const inferred = apiKey.startsWith('sk_live_') ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL
    const baseUrl = env.WEWIRE_BASE_URL ?? inferred

    if (apiKey.startsWith('sk_test_') && baseUrl === PRODUCTION_BASE_URL) {
      throw new Error('A sk_test_ key cannot be used against the production base URL')
    }
    if (apiKey.startsWith('sk_live_') && baseUrl !== PRODUCTION_BASE_URL) {
      throw new Error('A sk_live_ key must not be pointed at a non-production base URL')
    }
    if (!env.WEWIRE_WEBHOOK_SECRET!.startsWith('whsec_')) {
      throw new Error('WEWIRE_WEBHOOK_SECRET must start with whsec_')
    }

    env.wewire = {
      apiKey,
      baseUrl,
      webhookSecret: env.WEWIRE_WEBHOOK_SECRET!,
      escrowSubCustomerId: env.WEWIRE_ESCROW_SUBCUSTOMER_ID!,
    }
  }

  return env
}
