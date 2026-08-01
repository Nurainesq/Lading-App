import type {
  CreateDealInput,
  DealDto,
  FundDealInput,
  MoneyDto,
  SessionDto,
} from '@lading/shared'

/**
 * The API client.
 *
 * Requests and responses are typed by the shared contracts, so a field
 * renamed on the server is a compile error here rather than a blank space on
 * a trader's screen.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Field-level messages, keyed by form field. */
  readonly fields: Record<string, string>

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }

  /** Whether the trader should be sent back to sign in. */
  get needsSignIn(): boolean {
    return this.status === 401
  }
}

const TOKEN_KEY = 'lading.session'

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Private browsing can throw on storage access; treat as signed out.
    return null
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY)
    else localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Non-fatal: the session simply will not survive a reload.
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth = true, headers, ...rest } = init

  const merged: Record<string, string> = {
    accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  }
  if (rest.body !== undefined) merged['content-type'] = 'application/json'

  const token = auth ? readToken() : null
  if (token) merged.authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, { ...rest, headers: merged })
  } catch {
    // A dropped connection must not read as "no deals" — it is an error.
    throw new ApiError(0, 'OFFLINE', 'Cannot reach Lading. Check your connection.')
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = undefined
    }
  }

  if (!response.ok) {
    const body = parsed as { error?: { code?: string; message?: string; fields?: Record<string, string> } }
    const error = body?.error
    if (response.status === 401) writeToken(null)
    throw new ApiError(
      response.status,
      error?.code ?? `HTTP_${response.status}`,
      error?.message ?? 'Something went wrong',
      error?.fields ?? {},
    )
  }

  return parsed as T
}

export const api = {
  /** Asks for a sign-in code. The response is the same whether or not the
   * number is known, so it cannot be used to discover who has an account. */
  requestOtp(phone: string): Promise<{ status: string }> {
    return request('/v1/auth/otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
      auth: false,
    })
  },

  verifyOtp(phone: string, code: string): Promise<SessionDto> {
    return request('/v1/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
      auth: false,
    })
  },

  /** Indicative figures for the review screen. Creates nothing. */
  quote(input: {
    value: string
    currency: string
    fundingCurrency: string
    settlementCurrency: string
  }): Promise<{
    value: MoneyDto
    fee: MoneyDto
    payIn: MoneyDto
    totalDue: MoneyDto
    settlementAmount: MoneyDto
    indicative: true
  }> {
    return request('/v1/quotes', { method: 'POST', body: JSON.stringify(input) })
  },

  listDeals(): Promise<{ deals: DealDto[] }> {
    return request('/v1/deals')
  },

  getDeal(id: string): Promise<DealDto> {
    return request(`/v1/deals/${id}`)
  },

  createDeal(input: CreateDealInput): Promise<DealDto> {
    return request('/v1/deals', { method: 'POST', body: JSON.stringify(input) })
  },

  sendDeal(id: string): Promise<{ deal: DealDto; inviteUrl: string }> {
    return request(`/v1/deals/${id}/send`, { method: 'POST' })
  },

  /** Unauthenticated by design: the seller arrives from a link with no account. */
  acceptInvite(token: string): Promise<DealDto> {
    return request(`/v1/invites/${token}/accept`, { method: 'POST', auth: false })
  },

  fundDeal(
    id: string,
    input: FundDealInput,
  ): Promise<{ status: string; transactionId: string; deal: DealDto }> {
    return request(`/v1/deals/${id}/fund`, { method: 'POST', body: JSON.stringify(input) })
  },

  confirmShipment(id: string, detail: string): Promise<DealDto> {
    return request(`/v1/deals/${id}/shipment`, {
      method: 'POST',
      body: JSON.stringify({ detail }),
    })
  },

  presentDocuments(id: string, documentIds: string[]): Promise<DealDto> {
    return request(`/v1/deals/${id}/documents/present`, {
      method: 'POST',
      body: JSON.stringify({ documentIds }),
    })
  },

  releaseDeal(id: string): Promise<DealDto> {
    return request(`/v1/deals/${id}/release`, { method: 'POST' })
  },

  raiseDiscrepancy(
    id: string,
    reason: string,
    note?: string,
  ): Promise<DealDto> {
    return request(`/v1/deals/${id}/discrepancy`, {
      method: 'POST',
      body: JSON.stringify({ reason, note }),
    })
  },

  resolveDiscrepancy(
    id: string,
    outcome: 'RELEASE' | 'REFUND' | 'REPRESENT',
    note?: string,
  ): Promise<DealDto> {
    return request(`/v1/deals/${id}/discrepancy/resolve`, {
      method: 'POST',
      body: JSON.stringify({ outcome, note }),
    })
  },
}
