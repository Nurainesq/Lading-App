import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { PrismaClient } from '@prisma/client'
import { AppError } from '../http/errors.ts'
import { requireSession } from '../http/session.ts'
import {
  MAX_DOCUMENT_BYTES,
  UnsupportedDocumentError,
  type Storage,
} from '../storage/storage.ts'
import type { Env } from '../env.ts'

/**
 * Document upload and retrieval.
 *
 * A presented document is evidence, so the bytes are hashed on the way in and
 * the digest is stored alongside the metadata — a document cannot be swapped
 * for another after it has been presented without the digest changing.
 */

const DOCUMENT_KINDS = [
  'BILL_OF_LADING',
  'COMMERCIAL_INVOICE',
  'PACKING_LIST',
  'CERTIFICATE_OF_INCORPORATION',
  'DIRECTOR_ID',
  'PROOF_OF_ADDRESS',
  'OTHER',
] as const

const idParam = z.object({ id: z.string().uuid() })
const kindField = z.enum(DOCUMENT_KINDS)

export function registerDocumentRoutes(
  app: FastifyInstance,
  {
    prisma,
    storage,
    env,
  }: { prisma: PrismaClient; storage: Storage; env: Env },
): void {
  const session = (request: Parameters<typeof requireSession>[0]) =>
    requireSession(request, env.JWT_SECRET)

  /** Only a party to the deal may attach to it or read from it. */
  async function assertParty(dealId: string, businessId: string) {
    const deal = await prisma.deal.findUnique({ where: { id: dealId } })
    if (!deal) throw AppError.notFound('No such deal')
    if (deal.buyerBusinessId !== businessId && deal.sellerBusinessId !== businessId) {
      throw AppError.notFound('No such deal')
    }
    return deal
  }

  app.post('/v1/deals/:id/documents', async (request, reply) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)
    const deal = await assertParty(id, businessId)

    // A presented document is already evidence in a live decision; replacing
    // the set mid-verification would change what was checked.
    if (deal.status === 'RELEASED' || deal.status === 'REFUNDED' || deal.status === 'CANCELLED') {
      throw AppError.conflict('DEAL_CLOSED', 'This deal is closed')
    }

    const file = await request.file({ limits: { fileSize: MAX_DOCUMENT_BYTES } })
    if (!file) throw new AppError(400, 'NO_FILE', 'Attach a document')

    const body = await file.toBuffer().catch(() => {
      throw new AppError(413, 'FILE_TOO_LARGE', 'That document is too large')
    })

    const kindResult = kindField.safeParse(
      (file.fields?.kind as { value?: string } | undefined)?.value ?? 'OTHER',
    )
    if (!kindResult.success) {
      throw new AppError(422, 'BAD_KIND', 'Unknown document kind')
    }

    let stored
    try {
      stored = await storage.put({
        prefix: `deals/${id}`,
        filename: file.filename,
        mimeType: file.mimetype,
        body,
      })
    } catch (cause) {
      if (cause instanceof UnsupportedDocumentError) {
        throw new AppError(422, cause.code, cause.message)
      }
      throw cause
    }

    // The same bytes presented twice is the same document, not two.
    const existing = await prisma.document.findFirst({
      where: { dealId: id, sha256: stored.sha256 },
    })
    if (existing) {
      await storage.delete(stored.key)
      return reply.status(200).send(serialise(existing))
    }

    const document = await prisma.document.create({
      data: {
        dealId: id,
        kind: kindResult.data,
        filename: file.filename,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.key,
        sha256: stored.sha256,
      },
    })

    return reply.status(201).send(serialise(document))
  })

  app.get('/v1/documents/:id/content', async (request, reply) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)

    const document = await prisma.document.findUnique({ where: { id } })
    if (!document?.dealId) throw AppError.notFound('No such document')
    await assertParty(document.dealId, businessId)

    const bytes = await storage.get(document.storageKey)

    return reply
      .header('content-type', document.mimeType)
      // Never inline: an uploaded file rendered in the origin could script it.
      .header(
        'content-disposition',
        `attachment; filename="${document.filename.replace(/"/g, '')}"`,
      )
      .header('x-content-type-options', 'nosniff')
      .send(bytes)
  })

  app.delete('/v1/documents/:id', async (request, reply) => {
    const { businessId } = await session(request)
    const { id } = idParam.parse(request.params)

    const document = await prisma.document.findUnique({ where: { id } })
    if (!document?.dealId) throw AppError.notFound('No such document')
    await assertParty(document.dealId, businessId)

    // Once presented, a document is part of the record of what was decided.
    if (document.presentedAt) {
      throw AppError.conflict('ALREADY_PRESENTED', 'A presented document cannot be removed')
    }

    await prisma.document.delete({ where: { id } })
    await storage.delete(document.storageKey)
    return reply.status(204).send()
  })
}

function serialise(document: {
  id: string
  kind: string
  filename: string
  sizeBytes: number
  sha256: string
  uploadedAt: Date
}) {
  return {
    id: document.id,
    kind: document.kind,
    filename: document.filename,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
    uploadedAt: document.uploadedAt.toISOString(),
  }
}
