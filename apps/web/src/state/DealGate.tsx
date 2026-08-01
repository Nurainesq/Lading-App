import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { SecondaryButton } from '@/components/Button'
import { ErrorNote, LoadingNote } from '@/components/Feedback'
import { useDeal } from '@/state/DealContext'

/**
 * Holds a screen back until its deal has actually loaded.
 *
 * Without this a failed fetch would fall through to whatever a screen chose
 * to render for missing data — which is how a seller ended up looking at a
 * fabricated escrow account number. A deal that will not load says so.
 */
export function DealGate({ children }: { children: ReactNode }) {
  const { deal, loading, error, refresh, preview } = useDeal()
  const navigate = useNavigate()

  if (deal || preview) return <>{children}</>

  if (loading) {
    return (
      <Screen label="Loading deal">
        <StatusBar />
        <Content center>
          <LoadingNote>LOADING DEAL…</LoadingNote>
        </Content>
      </Screen>
    )
  }

  return (
    <Screen label="Deal unavailable">
      <StatusBar />
      <Content center gap={22}>
        <Title size={30}>This deal isn't available</Title>
        <ErrorNote>
          {error ?? 'It may have been removed, or you may need to sign in again.'}
        </ErrorNote>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SecondaryButton onClick={() => void refresh()}>Try again</SecondaryButton>
          <SecondaryButton muted onClick={() => navigate('/deals')}>
            Back to your deals
          </SecondaryButton>
        </div>
      </Content>
    </Screen>
  )
}
