/**
 * Sign-in code delivery.
 *
 * Behind a seam for the same reason the escrow provider is: the code is what
 * stands between a phone number and a trader's deals, so the thing that sends
 * it must be swappable and testable without sending real messages.
 */

export interface SmsSender {
  readonly name: 'log' | 'twilio'
  send(input: { to: string; body: string }): Promise<{ id: string }>
}

export class SmsError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, { status, code }: { status: number; code: string }) {
    super(message)
    this.name = 'SmsError'
    this.status = status
    this.code = code
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500
  }
}

/** Development default: prints instead of sending. Never used in production. */
export class LogSmsSender implements SmsSender {
  readonly name = 'log' as const
  readonly #log: (message: string) => void

  constructor(log: (message: string) => void = console.log) {
    this.#log = log
  }

  async send({ to, body }: { to: string; body: string }): Promise<{ id: string }> {
    // Deliberately loud. This sits among structured JSON logs, and someone
    // running the app for the first time has to find their sign-in code in it.
    const code = /\b(\d{6})\b/.exec(body)?.[1]
    this.#log(
      [
        '',
        '  ┌─────────────────────────────────────────────',
        '  │  SMS not sent — OTP_DELIVERY=log',
        `  │  to    ${to}`,
        code ? `  │  CODE  ${code}` : `  │  ${body}`,
        '  └─────────────────────────────────────────────',
        '',
      ].join('\n'),
    )
    return { id: `log_${Date.now()}` }
  }
}

/**
 * Twilio, over the REST API directly — the SDK is a large dependency for one
 * form-encoded POST. Chosen because Ghana and the UAE both need reliable
 * international delivery.
 */
export class TwilioSmsSender implements SmsSender {
  readonly name = 'twilio' as const
  readonly #accountSid: string
  readonly #authToken: string
  readonly #from: string
  readonly #fetch: typeof fetch

  constructor({
    accountSid,
    authToken,
    from,
    fetchImpl = fetch,
  }: {
    accountSid: string
    authToken: string
    /** A Twilio number, or a Messaging Service SID (starts with MG). */
    from: string
    fetchImpl?: typeof fetch
  }) {
    this.#accountSid = accountSid
    this.#authToken = authToken
    this.#from = from
    this.#fetch = fetchImpl
  }

  async send({ to, body }: { to: string; body: string }): Promise<{ id: string }> {
    const form = new URLSearchParams({ To: to, Body: body })
    // A Messaging Service handles sender selection per country; a bare number
    // does not. Both are supported, so pick whichever the account has.
    if (this.#from.startsWith('MG')) form.set('MessagingServiceSid', this.#from)
    else form.set('From', this.#from)

    let response: Response
    try {
      response = await this.#fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.#accountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${this.#accountSid}:${this.#authToken}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: form,
        },
      )
    } catch {
      throw new SmsError('Could not reach the SMS provider', {
        status: 503,
        code: 'SMS_UNREACHABLE',
      })
    }

    const text = await response.text()
    if (!response.ok) {
      let code = `HTTP_${response.status}`
      let message = text.slice(0, 300)
      try {
        const parsed = JSON.parse(text) as { code?: number; message?: string }
        if (parsed.code) code = `TWILIO_${parsed.code}`
        if (parsed.message) message = parsed.message
      } catch {
        // Non-JSON body; the raw text above is the best available.
      }
      throw new SmsError(message, { status: response.status, code })
    }

    const parsed = JSON.parse(text) as { sid?: string }
    return { id: parsed.sid ?? 'unknown' }
  }
}
