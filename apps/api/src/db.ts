import { PrismaClient } from '@prisma/client'

/**
 * One client per process. Prisma pools connections itself, so constructing
 * more than one is a leak rather than a speed-up.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

export type Db = PrismaClient
