import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { GhostButton, PrimaryButton } from '@/components/Button'
import { Field } from '@/components/Field'
import { ErrorNote } from '@/components/Feedback'
import { Logo } from '@/components/Logo'
import { useSession } from '@/state/SessionContext'

/** 01 — Sign in. The promise is stated in one line, before any form. */
export function SignIn() {
  const navigate = useNavigate()
  const { requestCode } = useSession()
  const [phone, setPhone] = useState('+233 24 ')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      // The API wants E.164; the field is spaced for readability.
      await requestCode(phone.replace(/\s/g, ''))
      navigate('/sign-in/code')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a code')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen label="Sign in">
      <StatusBar />
      <Content pad="roomy" center="between">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <Logo size={56} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Title size={44}>Trade with people you haven't met.</Title>
            <p className="lede">
              Funds held per deal. Released when the shipping documents check out.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field label="BUSINESS PHONE">
            <div className="field__box" data-mono="lg">
              <input
                className="field__input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-label="Business phone"
                inputMode="tel"
                autoComplete="tel"
              />
            </div>
          </Field>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Sending…' : 'Continue'}
          </PrimaryButton>
          <GhostButton onClick={submit}>I have an invite code</GhostButton>
          <p className="legal" style={{ margin: 0 }}>
            FUNDS HELD ON WEWIRE LICENSED,
            <br />
            SAFEGUARDED INFRASTRUCTURE
          </p>
        </div>
      </Content>
    </Screen>
  )
}
