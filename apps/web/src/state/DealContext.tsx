import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { deal as fixture, type DealStatus, type ReleaseConditionId } from '@/data/deal'

export type Side = 'buying' | 'selling'
export type FundingSource = 'bank' | 'momo'
export type DiscrepancyReason = 'mismatch' | 'short' | 'forged' | 'other'

interface DealState {
  /** Which side of the trade the user is on. Drives everything after. */
  side: Side
  sellerName: string
  country: string
  contact: string
  goods: string
  value: string
  currency: string
  releaseCondition: ReleaseConditionId
  fundingSource: FundingSource
  discrepancyReason: DiscrepancyReason
  status: DealStatus
  /** Whether the buyer has ever settled a deal — switches home between states. */
  hasHistory: boolean
}

interface DealStore extends DealState {
  set: <K extends keyof DealState>(key: K, value: DealState[K]) => void
}

const initial: DealState = {
  side: 'buying',
  sellerName: fixture.seller.business,
  country: fixture.seller.country,
  contact: fixture.seller.contact,
  goods: fixture.goods,
  value: fixture.value.amount,
  currency: fixture.value.currency,
  releaseCondition: fixture.releaseCondition,
  fundingSource: 'bank',
  discrepancyReason: 'short',
  status: 'draft',
  hasHistory: false,
}

const DealCtx = createContext<DealStore | null>(null)

export function DealProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DealState>(initial)

  const store = useMemo<DealStore>(
    () => ({
      ...state,
      set: (key, value) => setState((prev) => ({ ...prev, [key]: value })),
    }),
    [state],
  )

  return <DealCtx.Provider value={store}>{children}</DealCtx.Provider>
}

export function useDeal(): DealStore {
  const ctx = useContext(DealCtx)
  if (!ctx) throw new Error('useDeal must be used inside a DealProvider')
  return ctx
}
