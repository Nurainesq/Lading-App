import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { IllegalTransitionError } from '@lading/shared'
import { ProviderError } from '../wewire/provider.ts'
import { WebhookVerificationError } from '../wewire/webhooks.ts'

/** An error safe to show a trader. Anything else becomes a generic 500. */
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.fields = fields
  }

  static notFound(what = 'Not found') {
    return new AppError(404, 'NOT_FOUND', what)
  }

  static unauthorized(message = 'Sign in to continue') {
    return new AppError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message = 'This is not your deal') {
    return new AppError(403, 'FORBIDDEN', message)
  }

  static conflict(code: string, message: string) {
    return new AppError(409, code, message)
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.status)
        .send({ error: { code: error.code, message: error.message, fields: error.fields } })
    }

    if (error instanceof ZodError) {
      const fields: Record<string, string> = {}
      for (const issue of error.issues) {
        const path = issue.path.join('.') || '_'
        fields[path] ??= issue.message
      }
      return reply
        .status(422)
        .send({ error: { code: 'VALIDATION_FAILED', message: 'Check the details', fields } })
    }

    // An illegal transition means someone tried to move money at a point in
    // the lifecycle where it is not allowed. That is a conflict, not a bug.
    if (error instanceof IllegalTransitionError) {
      return reply
        .status(409)
        .send({ error: { code: 'ILLEGAL_TRANSITION', message: error.message } })
    }

    if (error instanceof WebhookVerificationError) {
      request.log.warn({ err: error }, 'rejected a webhook delivery')
      return reply.status(400).send({ error: { code: 'INVALID_SIGNATURE', message: 'Rejected' } })
    }

    if (error instanceof ProviderError) {
      request.log.error(
        { err: error, providerCode: error.code, requestId: error.requestId },
        'escrow provider call failed',
      )
      // Never leak the provider's message to a trader; it may name internals.
      return reply.status(502).send({
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: error.retryable
            ? 'The escrow provider is temporarily unavailable. Try again shortly.'
            : 'The escrow provider rejected this request.',
        },
      })
    }

    // Fastify's own schema validation failures carry a `validation` array.
    const fastifyError = error as { validation?: unknown; message?: string }
    if (fastifyError.validation) {
      return reply.status(400).send({
        error: { code: 'BAD_REQUEST', message: fastifyError.message ?? 'Bad request' },
      })
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply
      .status(500)
      .send({ error: { code: 'INTERNAL', message: 'Something went wrong' } })
  })
}
