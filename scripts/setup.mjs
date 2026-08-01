#!/usr/bin/env node
/**
 * First-run setup.
 *
 * Writes apps/api/.env with real random secrets, so nobody has to run openssl
 * — which does not exist on a plain Windows install. Safe to re-run: an
 * existing .env is never overwritten.
 */

import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, 'apps', 'api', '.env')

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  console.error(`\nNode 22 or newer is required. You have ${process.versions.node}.`)
  console.error('Download the LTS installer from https://nodejs.org and run this again.\n')
  process.exit(1)
}

if (existsSync(envPath)) {
  console.log('apps/api/.env already exists — leaving it alone.')
  console.log('Delete it and re-run this if you want a fresh one.\n')
} else {
  // Both need real entropy: one signs sessions, the other authenticates the
  // callbacks that mark a deal funded.
  const jwtSecret = randomBytes(48).toString('base64')
  const webhookSecret = `whsec_${randomBytes(32).toString('base64')}`

  const password = process.env.PGPASSWORD ?? 'postgres'
  const database = process.env.PGDATABASE ?? 'lading'
  const host = process.env.PGHOST ?? 'localhost'
  const port = process.env.PGPORT ?? '5432'
  const user = process.env.PGUSER ?? 'postgres'

  writeFileSync(
    envPath,
    `# Written by \`npm run setup\`. Not committed — it holds secrets.

NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:5173

# If your PostgreSQL password is not "${password}", change it here and nowhere else.
DATABASE_URL=postgresql://${user}:${password}@${host}:${port}/${database}?schema=public

JWT_SECRET=${jwtSecret}

# Runs the whole journey in memory — no WeWire account needed.
ESCROW_PROVIDER=mock

# Needed even without a WeWire account: the webhook endpoint refuses unsigned
# deliveries, so without this a deal could never become funded.
WEWIRE_WEBHOOK_SECRET=${webhookSecret}

# Sign-in codes are printed in the API window instead of being texted.
OTP_DELIVERY=log

# Uploaded documents are written next to the API instead of to cloud storage.
STORAGE_DRIVER=disk
STORAGE_DISK_ROOT=./.storage
`,
    'utf8',
  )

  console.log('Created apps/api/.env with fresh secrets.')
  if (password === 'postgres') {
    console.log(
      '\nIf you set a different PostgreSQL password during installation,\n' +
        'open apps/api/.env and change it on the DATABASE_URL line.',
    )
  }
}

const url = /^DATABASE_URL=(.+)$/m.exec(readFileSync(envPath, 'utf8'))?.[1]
console.log(`\nDatabase: ${url?.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@')}`)
console.log('\nNext:')
console.log('  npm run db:setup      create the tables')
console.log('  npm run dev           start the app, then open http://localhost:5173\n')
