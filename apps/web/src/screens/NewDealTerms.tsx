import { useNavigate } from 'react-router-dom'
import { RELEASE_CONDITIONS } from '@lading/shared'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { AmountInput, Field, FieldLabel, TextInput } from '@/components/Field'
import { Choice, ChoiceGroup } from '@/components/Choice'
import { useDraft } from '@/state/DraftContext'

/** The one sentence that decides the release, in the trader's words. */
const CONDITION_COPY: Record<
  (typeof RELEASE_CONDITIONS)[number],
  { label: string; detail?: string }
> = {
  VERIFIED_BILL_OF_LADING: {
    label: 'Bill of lading presented and verified',
    detail: 'Must match consignee, goods description and vessel on these terms.',
  },
  DELIVERY_CONFIRMATION: { label: 'On delivery confirmation at Tema' },
  SPLIT_SHIPPING_DELIVERY: { label: 'Split: 50% on shipping, 50% on delivery' },
}

/** 05 — The conditions engine, made plain: one sentence decides the release. */
export function NewDealTerms() {
  const navigate = useNavigate()
  const { draft, set } = useDraft()

  const ready = draft.goods.trim() !== '' && draft.value.trim() !== ''

  return (
    <Screen label="New deal — terms">
      <StatusBar />
      <NavBar label="NEW DEAL · 2 OF 3" onBack={() => navigate('/deal/new/counterparty')} />
      <Content gap={22}>
        <Title size={32}>Terms and release condition</Title>

        <Field label="GOODS">
          <TextInput
            label="Goods"
            value={draft.goods}
            onChange={(v) => set('goods', v)}
            placeholder="Toyota & Nissan spare parts"
          />
        </Field>

        <Field
          label="DEAL VALUE"
          hint={
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-dim)' }}>
              YOU FUND IN {draft.fundingCurrency} · SELLER RECEIVES {draft.settlementCurrency}
            </span>
          }
        >
          <AmountInput
            value={draft.value}
            onChange={(v) => set('value', v)}
            currency={draft.currency}
          />
        </Field>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FieldLabel>RELEASE WHEN</FieldLabel>
          <ChoiceGroup label="Release condition">
            {RELEASE_CONDITIONS.map((condition) => (
              <Choice
                key={condition}
                title={CONDITION_COPY[condition].label}
                detail={
                  draft.releaseCondition === condition
                    ? CONDITION_COPY[condition].detail
                    : undefined
                }
                selected={draft.releaseCondition === condition}
                onSelect={() => set('releaseCondition', condition)}
              />
            ))}
          </ChoiceGroup>
        </div>

        <div className="spacer">
          <PrimaryButton disabled={!ready} onClick={() => navigate('/deal/new/review')}>
            Next — review
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
