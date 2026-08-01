import { SignJWT, jwtVerify } from 'jose'
import type { FastifyRequest } from 'fastify'
import { AppError } from './errors.ts'

/**
 * Session tokens.
 *
 * Short-lived and signed. The token carries the business id so authorisation
 * checks never have to trust a client-supplied one.
 */

const ISSUER = 'lading'
const AUDIENCE = 'lading-app'
const TTL_SECONDS = 60 * 60 * 12

export interface Session {
  userId: string
  businessId: string
}

function keyFrom(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function issueSession(session: Session, secret: string): Promise<string> {
  return new SignJWT({ businessId: session.businessId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(keyFrom(secret))
}

export async function readSession(token: string, secret: string): Promise<Session> {
  try {
    const { payload } = await jwtVerify(token, keyFrom(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    const businessId = payload.businessId
    if (typeof payload.sub !== 'string' || typeof businessId !== 'string') {
      throw new Error('malformed claims')
    }
    return { userId: payload.sub, businessId }
  } catch {
    throw AppError.unauthorized('Your session has expired. Sign in again.')
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    session?: Session
  }
}

/** Reads and verifies the bearer token, or throws 401. */
export async function requireSession(
  request: FastifyRequest,
  secret: string,
): Promise<Session> {
  if (request.session) return request.session
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized()
  }
  const session = await readSession(header.slice('Bearer '.length).trim(), secret)
  request.session = session
  return session
}
