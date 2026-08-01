import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { requestOtpSchema, verifyOtpSchema } from '@lading/shared'
import { AppError } from '../http/errors.ts'
import { issueSession } from '../http/session.ts'
import type { PrismaClient } from '@prisma/client'
import { SmsError, type SmsSender } from '../sms/sender.ts'
import type { Env } from '../env.ts'

/**
 * Phone-based sign-in. A trader has no username — the business phone is the
 * identity, exactly as the design's first screen implies.
 */

const CODE_TTL_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5

function hashCode(phone: string, code: string): string {
  // Salted by phone so identical codes for different numbers do not collide,
  // and so the stored value is useless if the table leaks.
  return createHash('sha256').update(`${phone}:${code}`).digest('hex')
}

function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function registerAuthRoutes(
  app: FastifyInstance,
  { prisma, env, sms }: { prisma: PrismaClient; env: Env; sms: SmsSender },
): void {
  app.post('/v1/auth/otp', async (request, reply) => {
    const { phone } = requestOtpSchema.parse(request.body)

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

    await prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })

    try {
      await sms.send({
        to: phone,
        body: `${code} is your Lading sign-in code. It expires in 10 minutes.`,
      })
      // The code itself is never logged when it was really sent.
      request.log.info({ phone, sender: sms.name }, 'sent sign-in code')
    } catch (cause) {
      request.log.error({ err: cause, phone }, 'could not send sign-in code')
      // A provider outage is not the trader's fault, and a generic success
      // here would leave them waiting for a message that never arrives.
      if (cause instanceof SmsError) {
        throw new AppError(
          503,
          'SMS_UNAVAILABLE',
          'We could not send your code just now. Try again shortly.',
        )
      }
      throw cause
    }

    // The response is identical whether or not the number is known, so this
    // endpoint cannot be used to enumerate which businesses have accounts.
    return reply.status(202).send({ status: 'sent' })
  })

  app.post('/v1/auth/verify', async (request, reply) => {
    const { phone, code } = verifyOtpSchema.parse(request.body)

    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })
    if (!challenge) throw AppError.unauthorized('That code has expired. Ask for a new one.')

    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw AppError.unauthorized('Too many attempts. Ask for a new code.')
    }

    if (!constantTimeEquals(challenge.codeHash, hashCode(phone, code))) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      })
      throw AppError.unauthorized('That code is not right')
    }

    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    })

    // First sign-in creates the business alongside the user; KYB comes next.
    const user =
      (await prisma.user.findUnique({ where: { phone }, include: { business: true } })) ??
      (await prisma.user.create({
        data: { phone, business: { create: {} } },
        include: { business: true },
      }))

    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } })

    const token = await issueSession(
      { userId: user.id, businessId: user.businessId },
      env.JWT_SECRET,
    )

    return reply.send({
      token,
      business: {
        id: user.business.id,
        name: user.business.name,
        country: user.business.country,
        kybStatus: user.business.kybStatus,
      },
    })
  })
}
