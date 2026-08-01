/**
 * The wire contract between the app and the API.
 *
 * Both sides import these schemas, so a field renamed on the server is a
 * type error in the client rather than a blank space on a trader's screen.
 * Amounts cross the wire as decimal strings plus explicit minor units —
 * never as floats.
 */

import { z } from 'zod'
import { DEAL_STATUSES, DISCREPANCY_REASONS, DOCUMENT_CHECKS, RELEASE_CONDITIONS } from './deal.ts'

const CURRENCIES = ['USD', 'EUR', 'GBP', 'GHS', 'NGN', 'AED', 'CAD'] as const

export const currencySchema = z.enum(CURRENCIES)

export const moneySchema = z.object({
  currency: currencySchema,
  /** Integer minor units — the authoritative value. */
  minor: z.number().int(),
  /** Pre-formatted for display, e.g. "28,000.00". Never parsed by the client. */
  display: z.string(),
})
export type MoneyDto = z.infer<typeof moneySchema>

/* ------------------------------------------------------------------ auth */

export const requestOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'Enter a business phone in international format'),
})

export const verifyOtpSchema = z.object({
  phone: z.string().trim(),
  code: z.string().trim().regex(/^\d{6}$/, 'The code is six digits'),
})

export const sessionSchema = z.object({
  token: z.string(),
  business: z.object({
    id: z.string(),
    name: z.string().nullable(),
    country: z.string().nullable(),
    kybStatus: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']),
  }),
})
export type SessionDto = z.infer<typeof sessionSchema>

/* -------------------------------------------------------------- deals */

export const createDealSchema = z.object({
  side: z.enum(['BUYING', 'SELLING']),
  counterpartyName: z.string().trim().min(1, 'Who are you trading with?'),
  counterpartyCountry: z.string().trim().length(2, 'Two-letter country code'),
  counterpartyContact: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, 'A phone number so they can be invited'),
  goods: z.string().trim().min(1),
  /** Decimal string; the server parses to minor units. */
  value: z.string().trim(),
  currency: currencySchema,
  fundingCurrency: currencySchema,
  settlementCurrency: currencySchema,
  releaseCondition: z.enum(RELEASE_CONDITIONS),
  portOfLoading: z.string().trim().optional(),
  portOfDischarge: z.string().trim().optional(),
  windowDays: z.number().int().positive().max(365).optional(),
})
export type CreateDealInput = z.infer<typeof createDealSchema>

export const escrowAccountSchema = z.object({
  accountName: z.string(),
  accountNumber: z.string().nullable(),
  bankName: z.string().nullable(),
  iban: z.string().nullable(),
  currency: currencySchema,
  status: z.enum(['REQUESTED', 'PENDING', 'DENIED', 'ACTIVE', 'SUSPENDED', 'CLOSED']),
  heldBy: z.string(),
})

export const timelineEntrySchema = z.object({
  id: z.string(),
  kind: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  occurredAt: z.string(),
})

export const documentCheckSchema = z.object({
  name: z.enum(DOCUMENT_CHECKS),
  result: z.enum(['MATCH', 'MISMATCH', 'UNREADABLE']),
  detail: z.string().nullable(),
})

export const dealSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status: z.enum(DEAL_STATUSES),
  side: z.enum(['BUYING', 'SELLING']),

  buyerName: z.string(),
  sellerName: z.string(),
  goods: z.string(),
  route: z.string().nullable(),

  value: moneySchema,
  /** What the buyer pays, at the locked rate, including fee. */
  totalDue: moneySchema.nullable(),
  fee: moneySchema.nullable(),
  /** What the seller receives, at the locked rate. */
  settlementAmount: moneySchema.nullable(),
  rateLockedAt: z.string().nullable(),

  releaseCondition: z.enum(RELEASE_CONDITIONS),
  escrowAccount: escrowAccountSchema.nullable(),

  windowDays: z.number().int(),
  dayOfWindow: z.number().int().nullable(),

  documents: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      filename: z.string(),
      sizeBytes: z.number().int(),
      uploadedAt: z.string(),
    }),
  ),
  checks: z.array(documentCheckSchema),
  timeline: z.array(timelineEntrySchema),

  /** Present only while awaiting acceptance, so the buyer can forward it. */
  inviteUrl: z.string().nullable(),

  createdAt: z.string(),
  fundedAt: z.string().nullable(),
  releasedAt: z.string().nullable(),
})
export type DealDto = z.infer<typeof dealSchema>

/* ------------------------------------------------------------- actions */

/** Ghana corridor codes, as WeWire defines them. */
export const GHANA_BANKS = ['GCB', 'ECO', 'GTB'] as const
export const GHANA_NETWORKS = ['MTN', 'VOD', 'ATM'] as const

/**
 * Funding source. A discriminated union because the two channels need
 * genuinely different fields — a bank code is not a mobile network, and
 * accepting either for both is how the wrong code reaches the provider.
 */
export const fundDealSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('BANK'),
    bankCode: z.enum(GHANA_BANKS),
    accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Digits only'),
  }),
  z.object({
    source: z.literal('MOBILE_MONEY'),
    network: z.enum(GHANA_NETWORKS),
    /** Ghanaian mobile money numbers are ten digits. */
    msisdn: z.string().trim().regex(/^\d{10}$/, 'A ten-digit mobile money number'),
  }),
])
export type FundDealInput = z.infer<typeof fundDealSchema>

export const presentDocumentsSchema = z.object({
  documentIds: z.array(z.string()).min(1, 'Present at least one document'),
})

export const raiseDiscrepancySchema = z.object({
  reason: z.enum(DISCREPANCY_REASONS),
  note: z.string().trim().max(2000).optional(),
})

export const resolveDiscrepancySchema = z.object({
  outcome: z.enum(['RELEASE', 'REFUND', 'REPRESENT']),
  note: z.string().trim().max(2000).optional(),
})

/* -------------------------------------------------------------- errors */

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Field-level messages, keyed by path, for form display. */
    fields: z.record(z.string()).optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>
