import { randomBytes } from 'node:crypto'
import {
  applyEvent,
  convert,
  formatMoneyGrouped,
  money,
  parseMoney,
  type Currency,
  type DealEvent,
  type DealStatus,
  type LockedRate,
  type Money,
} from '@lading/shared'
import type { Prisma, Deal, PrismaClient } from '@prisma/client'
import { AppError } from '../http/errors.ts'
import { allocateReference } from './reference.ts'
import type { EscrowProvider } from '../wewire/provider.ts'

/**
 * Deal orchestration.
 *
 * Every status change goes through `transition`, which runs the shared state
 * machine and writes a timeline entry in the same database transaction. There
 * is no other way to change a deal's status, so the audit trail cannot drift
 * from what actually happened.
 */

type Tx = Prisma.TransactionClient

/** The escrow fee Lading charges, in basis points of the deal value. */
const FEE_BPS = 75n

export function feeFor(value: Money): Money {
  // Integer arithmetic throughout; rounded up so the fee is never under-taken.
  const minor = BigInt(value.minor)
  const fee = (minor * FEE_BPS + 9_999n) / 10_000n
  return money(value.currency, Number(fee))
}

function toMoney(minor: bigint | null, currency: string): Money | null {
  if (minor === null) return null
  return money(currency as Currency, Number(minor))
}

function dto(value: Money | null) {
  if (!value) return null
  return { currency: value.currency, minor: value.minor, display: formatMoneyGrouped(value) }
}

/**
 * Runs a lifecycle event. Throws IllegalTransitionError if the graph forbids
 * it — which is how the discrepancy freeze is enforced.
 */
async function transition(
  tx: Tx,
  deal: Pick<Deal, 'id' | 'status'>,
  event: DealEvent,
  timeline: { kind: string; label: string; detail?: string },
  extra: Prisma.DealUpdateInput = {},
): Promise<DealStatus> {
  const next = applyEvent(deal.status as DealStatus, event)

  // Guard against a concurrent request having already moved the deal on: the
  // update only applies if the status is still what we decided from.
  const updated = await tx.deal.updateMany({
    where: { id: deal.id, status: deal.status },
    data: { status: next, ...(extra as Prisma.DealUpdateManyMutationInput) },
  })
  if (updated.count === 0) {
    throw AppError.conflict('CONCURRENT_UPDATE', 'This deal changed while you were working on it')
  }

  await tx.timelineEvent.create({
    data: {
      dealId: deal.id,
      kind: timeline.kind,
      label: timeline.label,
      detail: timeline.detail ?? null,
      fromStatus: deal.status,
      toStatus: next,
    },
  })

  return next
}

export interface DealServiceDeps {
  prisma: PrismaClient
  provider: EscrowProvider
  escrowSubCustomerId: string
}

export class DealService {
  readonly #prisma: PrismaClient
  readonly #provider: EscrowProvider
  readonly #escrowSubCustomerId: string

  constructor({ prisma, provider, escrowSubCustomerId }: DealServiceDeps) {
    this.#prisma = prisma
    this.#provider = provider
    this.#escrowSubCustomerId = escrowSubCustomerId
  }

  async create(input: {
    businessId: string
    side: 'BUYING' | 'SELLING'
    counterpartyName: string
    counterpartyCountry: string
    counterpartyContact: string
    goods: string
    value: string
    currency: Currency
    fundingCurrency: Currency
    settlementCurrency: Currency
    releaseCondition: 'VERIFIED_BILL_OF_LADING' | 'DELIVERY_CONFIRMATION' | 'SPLIT_SHIPPING_DELIVERY'
    portOfLoading?: string
    portOfDischarge?: string
    windowDays?: number
  }) {
    // parseMoney rejects excess precision rather than rounding it away.
    const value = parseMoney(input.currency, input.value)
    if (value.minor <= 0) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Check the details', {
        value: 'The deal value must be more than zero',
      })
    }

    const reference = await allocateReference(async (candidate) => {
      const found = await this.#prisma.deal.findUnique({ where: { reference: candidate } })
      return found !== null
    })

    return this.#prisma.deal.create({
      data: {
        reference,
        status: 'DRAFT',
        creatorSide: input.side,
        buyerBusinessId: input.side === 'BUYING' ? input.businessId : null,
        sellerBusinessId: input.side === 'SELLING' ? input.businessId : null,
        counterpartyName: input.counterpartyName,
        counterpartyCountry: input.counterpartyCountry.toUpperCase(),
        counterpartyContact: input.counterpartyContact,
        goods: input.goods,
        portOfLoading: input.portOfLoading ?? null,
        portOfDischarge: input.portOfDischarge ?? null,
        windowDays: input.windowDays ?? 26,
        valueMinor: BigInt(value.minor),
        valueCurrency: value.currency,
        fundingCurrency: input.fundingCurrency,
        settlementCurrency: input.settlementCurrency,
        releaseCondition: input.releaseCondition,
        timeline: {
          create: { kind: 'DRAFTED', label: 'Deal drafted', toStatus: 'DRAFT' },
        },
      },
    })
  }

  /**
   * Indicative figures for the review screen, before anything is created.
   *
   * Explicitly not a lock: the rate is only held once the counterparty
   * accepts, so this is labelled as indicative rather than presented as the
   * settled number.
   */
  async quote(input: {
    value: string
    currency: Currency
    fundingCurrency: Currency
    settlementCurrency: Currency
  }) {
    const value = parseMoney(input.currency, input.value)
    const fee = feeFor(value)

    const fundingQuote = await this.#provider.getRate({
      from: value.currency,
      to: input.fundingCurrency,
    })
    const settlementQuote = await this.#provider.getRate({
      from: value.currency,
      to: input.settlementCurrency,
    })

    const asRate = (q: typeof fundingQuote, to: Currency): LockedRate => ({
      from: value.currency,
      to,
      scaledRate: q.scaledRate,
      scale: q.scale,
      lockedAt: new Date().toISOString(),
    })

    const fundedValue = convert(value, asRate(fundingQuote, input.fundingCurrency))
    const fundedFee = convert(fee, asRate(fundingQuote, input.fundingCurrency))
    const settlement = convert(value, asRate(settlementQuote, input.settlementCurrency))

    return {
      value: dto(value)!,
      fee: dto(fundedFee)!,
      payIn: dto(money(fundedValue.currency, fundedValue.minor))!,
      totalDue: dto(money(fundedValue.currency, fundedValue.minor + fundedFee.minor))!,
      settlementAmount: dto(settlement)!,
      indicative: true as const,
    }
  }

  /** Sends to the counterparty. They need no account — only the link. */
  async send(dealId: string, businessId: string) {
    const deal = await this.#load(dealId, businessId)
    const inviteToken = randomBytes(32).toString('base64url')

    return this.#prisma.$transaction(async (tx) => {
      await transition(
        tx,
        deal,
        'SEND_TO_COUNTERPARTY',
        { kind: 'SENT', label: 'Sent to counterparty', detail: deal.counterpartyName },
        {
          inviteToken,
          inviteExpiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      )
      return tx.deal.findUniqueOrThrow({ where: { id: dealId } })
    })
  }

  /**
   * The counterparty accepts. This is the point money becomes real: the rate
   * is locked for the whole window and a dedicated escrow account is issued.
   */
  async accept(inviteToken: string) {
    const deal = await this.#prisma.deal.findUnique({ where: { inviteToken } })
    if (!deal) throw AppError.notFound('This invitation is not valid')
    if (deal.inviteExpiresAt && deal.inviteExpiresAt < new Date()) {
      throw AppError.conflict('INVITE_EXPIRED', 'This invitation has expired')
    }

    const value = money(deal.valueCurrency as Currency, Number(deal.valueMinor))
    const fee = feeFor(value)

    // Both quotes are taken before anything is written, so a provider failure
    // leaves the deal untouched rather than half-accepted.
    const fundingQuote = await this.#provider.getRate({
      from: value.currency,
      to: deal.fundingCurrency as Currency,
    })
    const settlementQuote = await this.#provider.getRate({
      from: value.currency,
      to: deal.settlementCurrency as Currency,
    })

    const fundingRate: LockedRate = {
      from: value.currency,
      to: deal.fundingCurrency as Currency,
      scaledRate: fundingQuote.scaledRate,
      scale: fundingQuote.scale,
      lockedAt: new Date().toISOString(),
      quoteId: fundingQuote.quoteId ?? undefined,
    }

    const fundedValue = convert(value, fundingRate)
    const fundedFee = convert(fee, fundingRate)
    const totalDue = money(fundedValue.currency, fundedValue.minor + fundedFee.minor)
    const settlement = convert(value, {
      from: value.currency,
      to: deal.settlementCurrency as Currency,
      scaledRate: settlementQuote.scaledRate,
      scale: settlementQuote.scale,
      lockedAt: new Date().toISOString(),
    })

    const account = await this.#provider.requestAccount({
      subCustomerId: this.#escrowSubCustomerId,
      currency: deal.fundingCurrency as Currency,
      reference: deal.reference,
    })

    return this.#prisma.$transaction(async (tx) => {
      await transition(
        tx,
        deal,
        'ACCEPT_TERMS',
        { kind: 'ACCEPTED', label: 'Counterparty accepted', detail: deal.counterpartyName },
        {
          acceptedAt: new Date(),
          totalDueMinor: BigInt(totalDue.minor),
          feeMinor: BigInt(fundedFee.minor),
          settlementMinor: BigInt(settlement.minor),
          // The invite is single-use.
          inviteToken: null,
        },
      )

      await tx.rateLock.create({
        data: {
          dealId: deal.id,
          fromCurrency: fundingRate.from,
          toCurrency: fundingRate.to,
          scaledRate: BigInt(fundingRate.scaledRate),
          scale: fundingRate.scale,
          providerQuoteId: fundingQuote.quoteId,
          expiresAt: new Date(Date.now() + deal.windowDays * 24 * 60 * 60 * 1000),
        },
      })

      await tx.escrowAccount.create({
        data: {
          dealId: deal.id,
          providerAccountId: account.id,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          bankName: account.bankName,
          bankCode: account.bankCode,
          iban: account.iban,
          bic: account.bic,
          sortCode: account.sortCode,
          routingNumber: account.routingNumber,
          currency: account.currency,
          status: account.status,
        },
      })

      await tx.timelineEvent.create({
        data: {
          dealId: deal.id,
          kind: 'ACCOUNT_ISSUED',
          label: 'Escrow account issued',
          detail: account.accountNumber,
        },
      })

      return tx.deal.findUniqueOrThrow({ where: { id: deal.id } })
    })
  }

  /**
   * Starts the pay-in. The deal does NOT become funded here — only a confirmed
   * provider webhook may do that, because a client call cannot prove money moved.
   */
  async fund(
    dealId: string,
    businessId: string,
    input:
      | { source: 'BANK'; bankCode: string; accountNumber: string }
      | { source: 'MOBILE_MONEY'; network: string; msisdn: string },
  ) {
    const deal = await this.#load(dealId, businessId)
    if (deal.status !== 'AWAITING_FUNDING') {
      throw AppError.conflict('NOT_FUNDABLE', `A ${deal.status} deal cannot be funded`)
    }
    if (deal.totalDueMinor === null) {
      throw AppError.conflict('NO_RATE_LOCK', 'This deal has no locked rate yet')
    }

    const totalDue = money(deal.fundingCurrency as Currency, Number(deal.totalDueMinor))

    const transfer = await this.#provider.collect({
      // Stable per deal and attempt count, so a double-tap cannot double-charge.
      idempotencyKey: `${deal.reference}-fund`,
      amount: totalDue,
      channel: input.source === 'BANK' ? 'BANK' : 'MOBILE_MONEY',
      // One field on the wire, two different code sets behind it.
      accountCode: input.source === 'BANK' ? input.bankCode : input.network,
      accountNumber: input.source === 'BANK' ? input.accountNumber : input.msisdn,
      accountName: deal.counterpartyName,
      reference: deal.reference,
      memo: `Escrow funding ${deal.reference}`,
    })

    await this.#prisma.timelineEvent.create({
      data: {
        dealId: deal.id,
        kind: 'FUNDING_INITIATED',
        label: 'Funding initiated',
        detail: `${transfer.id} · ${transfer.status}`,
      },
    })

    return { transfer, totalDue }
  }

  /**
   * Called only from a verified provider webhook. Idempotent: a redelivery
   * finds the deal already funded and does nothing.
   */
  async markFunded(input: { reference: string; providerTransactionId: string; amount: Money }) {
    const deal = await this.#prisma.deal.findUnique({ where: { reference: input.reference } })
    if (!deal) return { applied: false, reason: 'unknown-reference' as const }
    if (deal.status !== 'AWAITING_FUNDING') {
      return { applied: false, reason: 'already-applied' as const }
    }

    await this.#prisma.$transaction(async (tx) => {
      await transition(tx, deal, 'FUNDS_CONFIRMED', {
        kind: 'FUNDED',
        label: 'Escrow funded',
        detail: input.providerTransactionId,
      }, { fundedAt: new Date() })

      await tx.ledgerEntry.create({
        data: {
          dealId: deal.id,
          direction: 'CREDIT',
          amountMinor: BigInt(input.amount.minor),
          currency: input.amount.currency,
          kind: 'funding',
          description: 'Buyer funded escrow',
          providerTransactionId: input.providerTransactionId,
        },
      })
    })

    return { applied: true as const }
  }

  async confirmShipment(dealId: string, businessId: string, detail: string) {
    const deal = await this.#load(dealId, businessId)
    return this.#prisma.$transaction(async (tx) => {
      await transition(
        tx,
        deal,
        'CONFIRM_SHIPMENT',
        { kind: 'SHIPPED', label: 'Seller confirmed shipment', detail },
        { shippedAt: new Date() },
      )
      return tx.deal.findUniqueOrThrow({ where: { id: dealId } })
    })
  }

  async present(dealId: string, businessId: string, documentIds: string[]) {
    const deal = await this.#load(dealId, businessId)
    const documents = await this.#prisma.document.findMany({
      where: { id: { in: documentIds }, dealId },
    })
    if (documents.length !== documentIds.length) {
      throw AppError.notFound('One of those documents is not on this deal')
    }

    const event: DealEvent =
      deal.status === 'DISCREPANCY' ? 'REPRESENT_DOCUMENTS' : 'PRESENT_DOCUMENTS'

    return this.#prisma.$transaction(async (tx) => {
      await tx.document.updateMany({
        where: { id: { in: documentIds } },
        data: { presentedAt: new Date() },
      })
      await transition(tx, deal, event, {
        kind: 'DOCUMENTS_PRESENTED',
        label: 'Documents presented',
        detail: documents.map((d) => d.filename).join(', '),
      })
      return tx.deal.findUniqueOrThrow({ where: { id: dealId } })
    })
  }

  async release(dealId: string, businessId: string) {
    const deal = await this.#load(dealId, businessId)
    if (deal.settlementMinor === null) {
      throw AppError.conflict('NO_SETTLEMENT', 'This deal has no settlement amount')
    }

    const amount = money(deal.settlementCurrency as Currency, Number(deal.settlementMinor))

    // Always the plain RELEASE event. A deal in DISCREPANCY has no RELEASE
    // edge, so this throws before any money is asked to move — which is the
    // point. Quietly upgrading it to RESOLVE_WITH_RELEASE here would let the
    // ordinary release button empty a frozen escrow.
    applyEvent(deal.status as DealStatus, 'RELEASE')

    const transfer = await this.#provider.payout({
      idempotencyKey: `${deal.reference}-release`,
      amount,
      beneficiaryId: deal.sellerBusinessId ?? deal.counterpartyName,
      beneficiaryAccountId: deal.reference,
      reference: deal.reference,
    })

    return this.#prisma.$transaction(async (tx) => {
      await transition(
        tx,
        deal,
        'RELEASE',
        { kind: 'RELEASED', label: 'Funds released', detail: transfer.id },
        { releasedAt: new Date() },
      )
      await tx.ledgerEntry.create({
        data: {
          dealId: deal.id,
          direction: 'DEBIT',
          amountMinor: BigInt(amount.minor),
          currency: amount.currency,
          kind: 'release',
          description: 'Released to seller',
          providerTransactionId: transfer.id,
        },
      })
      await tx.escrowAccount.updateMany({
        where: { dealId: deal.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
      return tx.deal.findUniqueOrThrow({ where: { id: dealId } })
    })
  }

  async raiseDiscrepancy(
    dealId: string,
    businessId: string,
    input: { reason: 'DOCUMENT_MISMATCH' | 'QUANTITY_SHORT' | 'SUSPECTED_FORGERY' | 'OTHER'; note?: string },
  ) {
    const deal = await this.#load(dealId, businessId)
    return this.#prisma.$transaction(async (tx) => {
      await transition(tx, deal, 'RAISE_DISCREPANCY', {
        kind: 'DISCREPANCY_RAISED',
        label: 'Discrepancy raised',
        detail: input.reason,
      })
      await tx.discrepancy.create({
        data: {
          dealId: deal.id,
          reason: input.reason,
          note: input.note ?? null,
          raisedByBusinessId: businessId,
          // Both sides get 5 days to agree an amended release.
          respondBy: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
      })
      return tx.deal.findUniqueOrThrow({ where: { id: dealId } })
    })
  }

  /**
   * The only way out of a frozen escrow, and it requires a stated outcome.
   * Deliberately separate from `release` so the ordinary release button can
   * never empty a deal that is under dispute.
   */
  async resolveDiscrepancy(
    dealId: string,
    businessId: string,
    input: { outcome: 'RELEASE' | 'REFUND' | 'REPRESENT'; note?: string },
  ) {
    const deal = await this.#load(dealId, businessId)
    if (deal.status !== 'DISCREPANCY') {
      throw AppError.conflict('NO_OPEN_DISCREPANCY', 'This deal has no open discrepancy')
    }

    const event: DealEvent =
      input.outcome === 'RELEASE'
        ? 'RESOLVE_WITH_RELEASE'
        : input.outcome === 'REFUND'
          ? 'RESOLVE_WITH_REFUND'
          : 'REPRESENT_DOCUMENTS'

    // Check the transition is legal before moving any money.
    applyEvent(deal.status as DealStatus, event)

    let transferId: string | null = null
    let settled: Money | null = null

    if (input.outcome === 'RELEASE' && deal.settlementMinor !== null) {
      settled = money(deal.settlementCurrency as Currency, Number(deal.settlementMinor))
      const transfer = await this.#provider.payout({
        idempotencyKey: `${deal.reference}-resolve-release`,
        amount: settled,
        beneficiaryId: deal.sellerBusinessId ?? deal.counterpartyName,
        beneficiaryAccountId: deal.reference,
        reference: deal.reference,
      })
      transferId = transfer.id
    } else if (input.outcome === 'REFUND' && deal.totalDueMinor !== null) {
      settled = money(deal.fundingCurrency as Currency, Number(deal.totalDueMinor))
      const transfer = await this.#provider.payout({
        idempotencyKey: `${deal.reference}-resolve-refund`,
        amount: settled,
        beneficiaryId: deal.buyerBusinessId ?? 'buyer',
        beneficiaryAccountId: deal.reference,
        reference: deal.reference,
      })
      transferId = transfer.id
    }

    return this.#prisma.$transaction(async (tx) => {
      await transition(
        tx,
        deal,
        event,
        {
          kind: `DISCREPANCY_${input.outcome}`,
          label: `Discrepancy resolved — ${input.outcome.toLowerCase()}`,
          detail: input.note,
        },
        input.outcome === 'REPRESENT' ? {} : { releasedAt: new Date() },
      )

      await tx.discrepancy.updateMany({
        where: { dealId: deal.id, resolvedAt: null },
        data: { resolvedAt: new Date(), resolution: input.outcome },
      })

      if (settled && transferId) {
        await tx.ledgerEntry.create({
          data: {
            dealId: deal.id,
            direction: 'DEBIT',
            amountMinor: BigInt(settled.minor),
            currency: settled.currency,
            kind: input.outcome === 'RELEASE' ? 'release' : 'refund',
            description: `Discrepancy resolved with ${input.outcome.toLowerCase()}`,
            providerTransactionId: transferId,
          },
        })
        await tx.escrowAccount.updateMany({
          where: { dealId: deal.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        })
      }

      return tx.deal.findUniqueOrThrow({ where: { id: dealId } })
    })
  }

  async #load(dealId: string, businessId: string) {
    const deal = await this.#prisma.deal.findUnique({ where: { id: dealId } })
    if (!deal) throw AppError.notFound('No such deal')
    if (deal.buyerBusinessId !== businessId && deal.sellerBusinessId !== businessId) {
      // 404 rather than 403: whether a deal exists is itself private.
      throw AppError.notFound('No such deal')
    }
    return deal
  }

  async get(dealId: string, businessId: string) {
    await this.#load(dealId, businessId)
    return this.serialise(dealId)
  }

  async list(businessId: string) {
    const deals = await this.#prisma.deal.findMany({
      where: {
        OR: [{ buyerBusinessId: businessId }, { sellerBusinessId: businessId }],
      },
      orderBy: { createdAt: 'desc' },
    })
    return Promise.all(deals.map((deal) => this.serialise(deal.id)))
  }

  /** Shapes a deal for the wire, matching the shared `dealSchema`. */
  async serialise(dealId: string) {
    const deal = await this.#prisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: {
        escrowAccount: true,
        documents: { orderBy: { uploadedAt: 'asc' } },
        checks: true,
        timeline: { orderBy: { occurredAt: 'asc' } },
        rateLock: true,
      },
    })

    const value = money(deal.valueCurrency as Currency, Number(deal.valueMinor))
    const dayOfWindow = deal.fundedAt
      ? Math.min(
          deal.windowDays,
          Math.max(
            1,
            Math.ceil((Date.now() - deal.fundedAt.getTime()) / (24 * 60 * 60 * 1000)),
          ),
        )
      : null

    const buyerName = deal.creatorSide === 'BUYING' ? 'You' : deal.counterpartyName
    const sellerName = deal.creatorSide === 'SELLING' ? 'You' : deal.counterpartyName

    return {
      id: deal.id,
      reference: deal.reference,
      status: deal.status,
      side: deal.creatorSide,

      buyerName,
      sellerName,
      goods: deal.goods,
      route:
        deal.portOfLoading && deal.portOfDischarge
          ? `${deal.portOfLoading} → ${deal.portOfDischarge}`
          : null,

      value: dto(value)!,
      totalDue: dto(toMoney(deal.totalDueMinor, deal.fundingCurrency)),
      fee: dto(toMoney(deal.feeMinor, deal.fundingCurrency)),
      settlementAmount: dto(toMoney(deal.settlementMinor, deal.settlementCurrency)),
      rateLockedAt: deal.rateLock?.lockedAt.toISOString() ?? null,

      releaseCondition: deal.releaseCondition,
      escrowAccount: deal.escrowAccount
        ? {
            accountName: deal.escrowAccount.accountName,
            accountNumber: deal.escrowAccount.accountNumber,
            bankName: deal.escrowAccount.bankName,
            iban: deal.escrowAccount.iban,
            currency: deal.escrowAccount.currency as Currency,
            status: deal.escrowAccount.status,
            heldBy:
              'WeWire — licensed, safeguarded. Lading has release rights only, never custody.',
          }
        : null,

      windowDays: deal.windowDays,
      dayOfWindow,

      documents: deal.documents.map((d) => ({
        id: d.id,
        kind: d.kind,
        filename: d.filename,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt.toISOString(),
      })),
      checks: deal.checks.map((c) => ({
        name: c.name,
        result: c.result,
        detail: c.detail,
      })),
      timeline: deal.timeline.map((t) => ({
        id: t.id,
        kind: t.kind,
        label: t.label,
        detail: t.detail,
        occurredAt: t.occurredAt.toISOString(),
      })),

      createdAt: deal.createdAt.toISOString(),
      fundedAt: deal.fundedAt?.toISOString() ?? null,
      releasedAt: deal.releasedAt?.toISOString() ?? null,
    }
  }
}
