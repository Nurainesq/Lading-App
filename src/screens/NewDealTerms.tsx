import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { AmountInput, Field, FieldLabel, TextInput } from '@/components/Field'
import { Choice, ChoiceGroup } from '@/components/Choice'
import { releaseConditions } from '@/data/deal'
import { useDeal } from '@/state/DealContext'

/** 05 — The conditions engine, made plain: one sentence decides the release. */
export function NewDealTerms() {
  const navigate = useNavigate()
  const deal = useDeal()

  return (
    <Screen label="New deal — terms">
      <StatusBar />
      <NavBar label="NEW DEAL · 2 OF 3" onBack={() => navigate('/deal/new/counterparty')} />
      <Content gap={22}>
        <Title size={32}>Terms and release condition</Title>

        <Field label="GOODS">
          <TextInput
            label="Goods"
            value={deal.goods}
            onChange={(v) => deal.set('goods', v)}
          />
        </Field>

        <Field
          label="DEAL VALUE"
          hint={
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
              YOU FUND IN GHS · SELLER RECEIVES AED
            </span>
          }
        >
          <AmountInput
            value={deal.value}
            onChange={(v) => deal.set('value', v)}
            currency={deal.currency}
          />
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldLabel>RELEASE WHEN</FieldLabel>
          <ChoiceGroup label="Release condition">
            {releaseConditions.map((condition) => (
              <Choice
                key={condition.id}
                title={condition.label}
                detail={deal.releaseCondition === condition.id ? condition.detail : undefined}
                selected={deal.releaseCondition === condition.id}
                onSelect={() => deal.set('releaseCondition', condition.id)}
              />
            ))}
          </ChoiceGroup>
        </div>

        <div className="spacer">
          <PrimaryButton onClick={() => navigate('/deal/new/review')}>
            Next — review
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
