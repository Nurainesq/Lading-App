import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { CreateDealInput } from '@lading/shared'

/**
 * The deal being written, across the three-step form.
 *
 * Held locally until the buyer sends it: a half-filled deal is not something
 * the escrow ledger should know about, and the design only commits at
 * "Send to seller".
 */

export type Draft = CreateDealInput

const initial: Draft = {
  side: 'BUYING',
  counterpartyName: '',
  counterpartyCountry: 'AE',
  counterpartyContact: '',
  goods: '',
  value: '',
  currency: 'USD',
  fundingCurrency: 'GHS',
  settlementCurrency: 'AED',
  releaseCondition: 'VERIFIED_BILL_OF_LADING',
  portOfLoading: 'Jebel Ali',
  portOfDischarge: 'Tema',
  windowDays: 26,
}

interface DraftStore {
  draft: Draft
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void
  reset: () => void
}

const DraftCtx = createContext<DraftStore | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(initial)

  const store = useMemo<DraftStore>(
    () => ({
      draft,
      set: (key, value) => setDraft((prev) => ({ ...prev, [key]: value })),
      reset: () => setDraft(initial),
    }),
    [draft],
  )

  return <DraftCtx.Provider value={store}>{children}</DraftCtx.Provider>
}

export function useDraft(): DraftStore {
  const ctx = useContext(DraftCtx)
  if (!ctx) throw new Error('useDraft must be used inside a DraftProvider')
  return ctx
}
