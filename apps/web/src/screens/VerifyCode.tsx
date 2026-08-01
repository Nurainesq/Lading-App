import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { GhostButton, PrimaryButton } from '@/components/Button'
import { Field } from '@/components/Field'
import { ErrorNote } from '@/components/Feedback'
import { useSession } from '@/state/SessionContext'

/**
 * Code entry.
 *
 * Not in the seventeen — the design goes straight from the phone field to a
 * verified state. Real phone sign-in needs this step, so it is built in the
 * same language: ink ground, one field, the promise restated underneath.
 */
export function VerifyCode() {
  const navigate = useNavigate()
  const { verifyCode, requestCode, pendingPhone } = useSession()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Landing here directly, with no code in flight, has nothing to verify.
  if (!pendingPhone) return <Navigate to="/" replace />

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await verifyCode(code.trim())
      navigate('/deals')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code is not right')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen label="Enter your code">
      <StatusBar />
      <NavBar label="SIGN IN" onBack={() => navigate('/')} />
      <Content gap={26}>
        <Title size={32}>Enter the code we sent</Title>
        <p className="body">
          Six digits, sent to <span className="mono">{pendingPhone}</span>.
        </p>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label="CODE">
          <div className="field__box" data-mono="lg">
            <input
              className="field__input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-label="Sign-in code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
            />
          </div>
        </Field>

        <div className="spacer" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PrimaryButton onClick={submit} disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Continue'}
          </PrimaryButton>
          <GhostButton onClick={() => void requestCode(pendingPhone)}>
            Send another code
          </GhostButton>
        </div>
      </Content>
    </Screen>
  )
}
