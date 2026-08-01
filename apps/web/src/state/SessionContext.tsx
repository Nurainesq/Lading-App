import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SessionDto } from '@lading/shared'
import { api, readToken, writeToken } from '@/api/client'

interface SessionStore {
  business: SessionDto['business'] | null
  signedIn: boolean
  /** The number a code was sent to, carried into the code screen. */
  pendingPhone: string | null
  requestCode: (phone: string) => Promise<void>
  verifyCode: (code: string) => Promise<void>
  signOut: () => void
}

const SessionCtx = createContext<SessionStore | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [business, setBusiness] = useState<SessionDto['business'] | null>(null)
  const [pendingPhone, setPendingPhone] = useState<string | null>(null)
  // A token in storage means a session survived a reload.
  const [signedIn, setSignedIn] = useState(() => readToken() !== null)

  const requestCode = useCallback(async (phone: string) => {
    await api.requestOtp(phone)
    setPendingPhone(phone)
  }, [])

  const verifyCode = useCallback(
    async (code: string) => {
      if (!pendingPhone) throw new Error('Ask for a code first')
      const session = await api.verifyOtp(pendingPhone, code)
      writeToken(session.token)
      setBusiness(session.business)
      setSignedIn(true)
      setPendingPhone(null)
    },
    [pendingPhone],
  )

  const signOut = useCallback(() => {
    writeToken(null)
    setBusiness(null)
    setSignedIn(false)
  }, [])

  const store = useMemo<SessionStore>(
    () => ({ business, signedIn, pendingPhone, requestCode, verifyCode, signOut }),
    [business, signedIn, pendingPhone, requestCode, verifyCode, signOut],
  )

  return <SessionCtx.Provider value={store}>{children}</SessionCtx.Provider>
}

export function useSession(): SessionStore {
  const ctx = useContext(SessionCtx)
  if (!ctx) throw new Error('useSession must be used inside a SessionProvider')
  return ctx
}
