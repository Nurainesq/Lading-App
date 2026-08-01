import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { DealDto } from '@lading/shared'
import { api } from '@/api/client'
import { previewDeal } from '@/api/preview'

/**
 * The deal a screen is looking at.
 *
 * Two providers satisfy this: `DealProvider` fetches from the API, and
 * `PreviewDealProvider` serves the design's own figures so the canvas can
 * render all seventeen screens without seventeen requests. Screens read the
 * same shape either way and never know which is running.
 */

export interface DealStore {
  deal: DealDto | null
  loading: boolean
  /** Set while an action is in flight, so buttons can be disabled. */
  busy: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Runs an action, refreshes the deal, and surfaces failures as `error`. */
  run: (action: (dealId: string) => Promise<DealDto | void>) => Promise<void>
  /** Preview mode: actions are inert rather than hitting a live API. */
  readonly preview: boolean
}

const DealCtx = createContext<DealStore | null>(null)

export function DealProvider({
  dealId,
  children,
}: {
  dealId: string | null
  children: ReactNode
}) {
  const [deal, setDeal] = useState<DealDto | null>(null)
  const [loading, setLoading] = useState(dealId !== null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!dealId) {
      setDeal(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setDeal(await api.getDeal(dealId))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this deal')
    } finally {
      setLoading(false)
    }
  }, [dealId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const run = useCallback(
    async (action: (id: string) => Promise<DealDto | void>) => {
      if (!dealId) return
      setBusy(true)
      setError(null)
      try {
        const next = await action(dealId)
        // Prefer the action's own response; fall back to a re-read.
        if (next) setDeal(next)
        else await refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'That did not work')
      } finally {
        setBusy(false)
      }
    },
    [dealId, refresh],
  )

  const store = useMemo<DealStore>(
    () => ({ deal, loading, busy, error, refresh, run, preview: false }),
    [deal, loading, busy, error, refresh, run],
  )

  return <DealCtx.Provider value={store}>{children}</DealCtx.Provider>
}

/** Serves the design's figures. Used by the canvas and by screen previews. */
export function PreviewDealProvider({
  children,
  deal,
}: {
  children: ReactNode
  deal?: Partial<DealDto>
}) {
  const store = useMemo<DealStore>(
    () => ({
      deal: previewDeal(deal),
      loading: false,
      busy: false,
      error: null,
      refresh: async () => {},
      run: async () => {},
      preview: true,
    }),
    [deal],
  )
  return <DealCtx.Provider value={store}>{children}</DealCtx.Provider>
}

export function useDeal(): DealStore {
  const ctx = useContext(DealCtx)
  if (!ctx) throw new Error('useDeal must be used inside a DealProvider')
  return ctx
}

/**
 * The deal, or the design's stand-in while one is loading. Screens that only
 * render figures use this so they never have to branch on loading state, and
 * so the layout never collapses mid-fetch.
 */
export function useDealFigures(): DealDto {
  const { deal } = useDeal()
  return deal ?? previewDeal()
}
