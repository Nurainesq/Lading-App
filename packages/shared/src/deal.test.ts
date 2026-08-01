import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEAL_STATUSES,
  IllegalTransitionError,
  allowedEvents,
  applyEvent,
  canTransition,
  checksSatisfyRelease,
  holdsFunds,
  isTerminal,
} from './deal.ts'

test('the happy path runs draft to released', () => {
  let status = applyEvent('DRAFT', 'SEND_TO_COUNTERPARTY')
  assert.equal(status, 'AWAITING_ACCEPTANCE')
  status = applyEvent(status, 'ACCEPT_TERMS')
  assert.equal(status, 'AWAITING_FUNDING')
  status = applyEvent(status, 'FUNDS_CONFIRMED')
  assert.equal(status, 'FUNDED')
  status = applyEvent(status, 'CONFIRM_SHIPMENT')
  assert.equal(status, 'IN_TRANSIT')
  status = applyEvent(status, 'PRESENT_DOCUMENTS')
  assert.equal(status, 'DOCUMENTS_PRESENTED')
  status = applyEvent(status, 'RELEASE')
  assert.equal(status, 'RELEASED')
})

test('an open discrepancy freezes the money', () => {
  // The product promises nobody can move funds during a discrepancy —
  // including us. There must be no direct RELEASE edge out of it.
  assert.equal(canTransition('DISCREPANCY', 'RELEASE'), false)
  assert.throws(() => applyEvent('DISCREPANCY', 'RELEASE'), IllegalTransitionError)

  // The only ways out are an agreed resolution or corrected documents.
  assert.equal(applyEvent('DISCREPANCY', 'RESOLVE_WITH_RELEASE'), 'RELEASED')
  assert.equal(applyEvent('DISCREPANCY', 'RESOLVE_WITH_REFUND'), 'REFUNDED')
  assert.equal(applyEvent('DISCREPANCY', 'REPRESENT_DOCUMENTS'), 'DOCUMENTS_PRESENTED')
})

test('funds cannot be released before they are held', () => {
  for (const status of ['DRAFT', 'AWAITING_ACCEPTANCE', 'AWAITING_FUNDING'] as const) {
    assert.equal(canTransition(status, 'RELEASE'), false, `${status} must not release`)
  }
})

test('a funded deal cannot be cancelled out from under the seller', () => {
  // Once money is committed, walking away is not unilateral — it has to go
  // through a discrepancy and an agreed refund.
  for (const status of ['FUNDED', 'IN_TRANSIT', 'DOCUMENTS_PRESENTED'] as const) {
    assert.equal(canTransition(status, 'CANCEL'), false, `${status} must not cancel`)
  }
})

test('terminal states accept nothing further', () => {
  for (const status of ['RELEASED', 'REFUNDED', 'CANCELLED'] as const) {
    assert.ok(isTerminal(status))
    assert.deepEqual(allowedEvents(status), [])
  }
})

test('holdsFunds covers exactly the states where money sits in escrow', () => {
  const holding = DEAL_STATUSES.filter(holdsFunds)
  assert.deepEqual(holding, ['FUNDED', 'IN_TRANSIT', 'DOCUMENTS_PRESENTED', 'DISCREPANCY'])
})

test('release needs all five checks to match', () => {
  const all = [
    { name: 'CONSIGNEE', result: 'MATCH' },
    { name: 'GOODS_DESCRIPTION', result: 'MATCH' },
    { name: 'VESSEL_AND_VOYAGE', result: 'MATCH' },
    { name: 'PORT_OF_DISCHARGE', result: 'MATCH' },
    { name: 'SHIPPED_ON_BOARD_DATE', result: 'MATCH' },
  ] as const

  assert.equal(checksSatisfyRelease([...all]), true)

  // One mismatch holds the money.
  assert.equal(
    checksSatisfyRelease([...all.slice(0, 4), { name: 'SHIPPED_ON_BOARD_DATE', result: 'MISMATCH' }]),
    false,
  )

  // A missing check is not a pass.
  assert.equal(checksSatisfyRelease([...all.slice(0, 4)]), false)

  // Nor is the same check repeated to make up the count.
  assert.equal(
    checksSatisfyRelease([...all.slice(0, 4), { name: 'CONSIGNEE', result: 'MATCH' }]),
    false,
  )
})
