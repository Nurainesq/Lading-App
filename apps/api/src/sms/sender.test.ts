import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LogSmsSender, SmsError, TwilioSmsSender } from './sender.ts'

interface Captured {
  url: string
  headers: Record<string, string>
  body: URLSearchParams
}

function stub(response: { status?: number; body?: unknown }) {
  const calls: Captured[] = []
  const impl: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: new URLSearchParams(String(init?.body ?? '')),
    })
    return new Response(JSON.stringify(response.body ?? { sid: 'SM123' }), {
      status: response.status ?? 201,
    })
  }
  return { impl, calls }
}

const creds = { accountSid: 'AC123', authToken: 'secret-token' }

test('sends through a Twilio number', async () => {
  const { impl, calls } = stub({})
  const sender = new TwilioSmsSender({ ...creds, from: '+15005550006', fetchImpl: impl })

  const result = await sender.send({ to: '+233244123456', body: '424242 is your code' })

  assert.equal(result.id, 'SM123')
  assert.equal(calls[0]?.url, 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json')
  assert.equal(calls[0]?.body.get('To'), '+233244123456')
  assert.equal(calls[0]?.body.get('From'), '+15005550006')
  assert.equal(calls[0]?.body.get('MessagingServiceSid'), null)

  const auth = calls[0]?.headers['authorization'] ?? ''
  assert.ok(auth.startsWith('Basic '))
  assert.equal(
    Buffer.from(auth.slice('Basic '.length), 'base64').toString(),
    'AC123:secret-token',
  )
})

test('a Messaging Service SID is sent as one, not as a From number', async () => {
  // Ghana and the UAE need per-country sender selection, which is what a
  // Messaging Service does; passing it as From would be rejected.
  const { impl, calls } = stub({})
  const sender = new TwilioSmsSender({ ...creds, from: 'MG9876', fetchImpl: impl })
  await sender.send({ to: '+971504482210', body: 'code' })

  assert.equal(calls[0]?.body.get('MessagingServiceSid'), 'MG9876')
  assert.equal(calls[0]?.body.get('From'), null)
})

test('surfaces a Twilio error with its code', async () => {
  const { impl } = stub({ status: 400, body: { code: 21211, message: 'Invalid To number' } })
  const sender = new TwilioSmsSender({ ...creds, from: '+15005550006', fetchImpl: impl })

  await assert.rejects(
    () => sender.send({ to: 'nonsense', body: 'code' }),
    (error: unknown) => {
      assert.ok(error instanceof SmsError)
      assert.equal(error.code, 'TWILIO_21211')
      assert.equal(error.retryable, false, 'a bad number must not be retried')
      return true
    },
  )
})

test('a transport failure is retryable', async () => {
  const impl: typeof fetch = async () => {
    throw new TypeError('network down')
  }
  const sender = new TwilioSmsSender({ ...creds, from: '+1', fetchImpl: impl })
  await assert.rejects(
    () => sender.send({ to: '+1', body: 'x' }),
    (error: unknown) => {
      assert.ok(error instanceof SmsError)
      assert.equal(error.code, 'SMS_UNREACHABLE')
      assert.equal(error.retryable, true)
      return true
    },
  )
})

test('the log sender does not pretend to send', async () => {
  const lines: string[] = []
  const sender = new LogSmsSender((line) => lines.push(line))
  const result = await sender.send({ to: '+233244123456', body: '424242 is your code' })
  assert.match(result.id, /^log_/)
  assert.equal(lines.length, 1)
  assert.match(lines[0]!, /\+233244123456/)
})
