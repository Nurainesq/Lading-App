import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Content, Screen, StatusBar, Title } from '@/components/Screen'
import { GhostButton, PrimaryButton } from '@/components/Button'
import { Field } from '@/components/Field'
import { Logo } from '@/components/Logo'

/** 01 — Sign in. The promise is stated in one line, before any form. */
export function SignIn() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('+233 24 ')

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
          <PrimaryButton onClick={() => navigate('/verify')}>Continue</PrimaryButton>
          <GhostButton onClick={() => navigate('/verify')}>I have an invite code</GhostButton>
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
