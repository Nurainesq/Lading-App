/**
 * Money is always integer minor units — pesewas, fils, cents — never a float.
 *
 * The product's whole claim is that a figure agreed on day 0 is the figure
 * settled on day 26. Binary floating point cannot represent 0.1 exactly, so
 * accumulating float arithmetic would drift the very number the escrow exists
 * to guarantee. Amounts crossing the API are strings for the same reason.
 */

export type Currency = 'USD' | 'EUR' | 'GBP' | 'GHS' | 'NGN' | 'AED' | 'CAD'

export interface Money {
  currency: Currency
  /** Integer minor units. 28_000.00 USD is 2_800_000. */
  minor: number
}

/** Minor units per major unit. All currencies Lading touches are 2-decimal. */
const EXPONENT: Record<Currency, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  GHS: 2,
  NGN: 2,
  AED: 2,
  CAD: 2,
}

export function exponentOf(currency: Currency): number {
  return EXPONENT[currency]
}

export function money(currency: Currency, minor: number): Money {
  if (!Number.isInteger(minor)) {
    throw new TypeError(`money(${currency}) requires integer minor units, got ${minor}`)
  }
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`money(${currency}) amount is outside the safe integer range`)
  }
  return { currency, minor }
}

/**
 * Parses a decimal string ("28,000.00") into minor units without ever going
 * through a float. Rejects anything with more precision than the currency has,
 * rather than silently rounding someone's money away.
 */
export function parseMoney(currency: Currency, input: string): Money {
  const cleaned = input.replace(/[\s,_]/g, '')
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(cleaned)
  if (!match) {
    throw new TypeError(`Cannot parse "${input}" as ${currency}`)
  }

  const [, sign, whole, fraction = ''] = match
  const exponent = exponentOf(currency)

  if (fraction.length > exponent) {
    throw new RangeError(
      `${input} has more precision than ${currency} supports (${exponent} decimals)`,
    )
  }

  const padded = fraction.padEnd(exponent, '0')
  const minor = Number(`${sign}${whole}${padded}`)
  return money(currency, minor)
}

/** Renders minor units back to a plain decimal string — no grouping, no symbol. */
export function formatMoney({ currency, minor }: Money): string {
  const exponent = exponentOf(currency)
  const negative = minor < 0
  const digits = Math.abs(minor).toString().padStart(exponent + 1, '0')
  const whole = digits.slice(0, digits.length - exponent)
  const fraction = digits.slice(digits.length - exponent)
  return `${negative ? '-' : ''}${whole}${exponent > 0 ? `.${fraction}` : ''}`
}

/** Renders for display, with thousands separators: "28,000.00". */
export function formatMoneyGrouped(value: Money): string {
  const plain = formatMoney(value)
  const [whole, fraction] = plain.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${grouped}.${fraction}` : grouped
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`Cannot combine ${a.currency} with ${b.currency}`)
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.currency, a.minor + b.minor)
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.currency, a.minor - b.minor)
}

export function isZero(value: Money): boolean {
  return value.minor === 0
}

export function isPositive(value: Money): boolean {
  return value.minor > 0
}

export function equalsMoney(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minor === b.minor
}

/**
 * Applies a locked FX rate. The rate is stored as an integer scaled by
 * 10^scale so a quote can be persisted and replayed exactly — the rate the
 * buyer was shown must be the rate that settles, 26 days later.
 */
export interface LockedRate {
  from: Currency
  to: Currency
  /** rate = scaledRate / 10^scale, e.g. 12.2 GHS/USD at scale 6 is 12_200_000. */
  scaledRate: number
  scale: number
  lockedAt: string
  /** Provider quote this rate came from, for audit. */
  quoteId?: string
}

export function convert(amount: Money, rate: LockedRate): Money {
  if (amount.currency !== rate.from) {
    throw new TypeError(`Rate converts ${rate.from}, not ${amount.currency}`)
  }
  const fromExp = exponentOf(rate.from)
  const toExp = exponentOf(rate.to)
  const divisor = 10 ** rate.scale * 10 ** fromExp
  const product = amount.minor * rate.scaledRate * 10 ** toExp
  // Round half-up on the final minor unit; never truncate silently.
  return money(rate.to, Math.round(product / divisor))
}
