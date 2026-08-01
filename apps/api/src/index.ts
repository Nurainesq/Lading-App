import { buildApp } from './app.ts'
import { loadEnv } from './env.ts'
import { prisma } from './db.ts'

/**
 * Entry point. Configuration is validated before anything binds a port, so a
 * missing escrow credential fails at boot rather than mid-deal.
 */
async function main(): Promise<void> {
  const env = loadEnv()
  const app = await buildApp({ env, prisma })

  if (env.ESCROW_PROVIDER === 'mock') {
    app.log.warn(
      'ESCROW_PROVIDER=mock — money movement is simulated in memory. ' +
        'Set ESCROW_PROVIDER=wewire with a real key before touching live funds.',
    )
  }

  const close = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    // Drain in-flight requests before dropping the database connection, so a
    // release in progress is not cut off half-written.
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }

  process.on('SIGTERM', () => void close('SIGTERM'))
  process.on('SIGINT', () => void close('SIGINT'))

  await app.listen({ port: env.PORT, host: '0.0.0.0' })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
