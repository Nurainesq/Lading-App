import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addMoney,
  convert,
  formatMoney,
  formatMoneyGrouped,
  money,
  parseMoney,
  subtractMoney,
  type LockedRate,
} from './money.ts'

test('parses the deal figures from the design', () => {
  assert.deepEqual(parseMoney('USD', '28,000.00'), { currency: 'USD', minor: 2_800_000 })
  assert.deepEqual(parseMoney('GHS', '344,162.00'), { currency: 'GHS', minor: 34_416_200 })
  assert.deepEqual(parseMoney('AED', '102,844.00'), { currency: 'AED', minor: 10_284_400 })
})

test('round-trips through formatting', () => {
  assert.equal(formatMoney(parseMoney('USD', '28000.00')), '28000.00')
  assert.equal(formatMoneyGrouped(parseMoney('GHS', '344162.00')), '344,162.00')
  assert.equal(formatMoney(money('USD', 5)), '0.05')
  assert.equal(formatMoney(money('USD', 0)), '0.00')
  assert.equal(formatMoney(money('USD', -250)), '-2.50')
})

test('refuses precision the currency cannot hold', () => {
  // Silently rounding here would lose a trader's money.
  assert.throws(() => parseMoney('USD', '10.005'), RangeError)
  assert.throws(() => parseMoney('USD', 'not money'), TypeError)
  assert.throws(() => money('USD', 1.5), TypeError)
})

test('refuses to mix currencies', () => {
  assert.throws(() => addMoney(money('USD', 100), money('GHS', 100)), TypeError)
})

test('the classic float error does not occur', () => {
  // 0.1 + 0.2 !== 0.3 in binary floating point. In minor units it is exact.
  const total = addMoney(parseMoney('USD', '0.10'), parseMoney('USD', '0.20'))
  assert.equal(formatMoney(total), '0.30')
  assert.equal(total.minor, 30)
})

test('escrow fee arithmetic is exact', () => {
  const funded = parseMoney('GHS', '344,162.00')
  const fee = parseMoney('GHS', '2,562.00')
  assert.equal(formatMoneyGrouped(subtractMoney(funded, fee)), '341,600.00')
})

test('a locked rate replays exactly', () => {
  // 12.2 GHS per USD, scaled by 10^6.
  const rate: LockedRate = {
    from: 'USD',
    to: 'GHS',
    scaledRate: 12_200_000,
    scale: 6,
    lockedAt: '2026-08-01T14:41:00Z',
  }

  const escrowed = parseMoney('USD', '28,000.00')
  const inCedis = convert(escrowed, rate)
  assert.equal(inCedis.currency, 'GHS')
  assert.equal(formatMoneyGrouped(inCedis), '341,600.00')

  // Replaying the same locked rate 26 days later gives the identical figure —
  // that is the guarantee the product sells.
  assert.deepEqual(convert(escrowed, rate), inCedis)
})

test('converting the wrong currency is rejected', () => {
  const rate: LockedRate = {
    from: 'USD',
    to: 'GHS',
    scaledRate: 12_200_000,
    scale: 6,
    lockedAt: '2026-08-01T14:41:00Z',
  }
  assert.throws(() => convert(money('AED', 100), rate), TypeError)
})
