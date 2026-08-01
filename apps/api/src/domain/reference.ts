import { randomInt } from 'node:crypto'

/**
 * Deal references, e.g. LD-4471.
 *
 * Traders read these aloud and type them into messages, so they stay short.
 * They are random rather than sequential: a sequential reference would let
 * anyone with one deal work out how much business Lading is doing, and would
 * make another trader's reference trivially guessable.
 */

const PREFIX = 'LD'
const MIN = 1000
const MAX = 9999

export function generateReference(): string {
  return `${PREFIX}-${randomInt(MIN, MAX + 1)}`
}

/**
 * Draws a reference that is not already taken. The space is small, so this
 * retries rather than assuming a first pick is free.
 */
export async function allocateReference(
  exists: (reference: string) => Promise<boolean>,
  attempts = 12,
): Promise<string> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = generateReference()
    if (!(await exists(candidate))) return candidate
  }
  // Space exhausted at this length: widen rather than spin or collide.
  return `${PREFIX}-${randomInt(10_000, 100_000)}`
}

export function isReference(value: string): boolean {
  return /^LD-\d{4,5}$/.test(value)
}
