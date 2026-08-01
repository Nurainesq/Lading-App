import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { Field, SelectBox, TextInput } from '@/components/Field'
import { Segmented } from '@/components/Choice'
import { useDeal } from '@/state/DealContext'

/** 04 — Counterparty. Side comes first, because it drives everything after. */
export function NewDealCounterparty() {
  const navigate = useNavigate()
  const deal = useDeal()

  return (
    <Screen label="New deal — counterparty">
      <StatusBar />
      <NavBar label="NEW DEAL · 1 OF 3" onBack={() => navigate('/deals')} />
      <Content gap={26}>
        <Title size={32}>Who are you trading with?</Title>

        <Segmented
          label="Which side of this trade are you on?"
          value={deal.side}
          onChange={(id) => deal.set('side', id as typeof deal.side)}
          options={[
            { id: 'buying', label: "I'm buying" },
            { id: 'selling', label: "I'm selling" },
          ]}
        />

        <Field label={deal.side === 'buying' ? 'SELLER BUSINESS NAME' : 'BUYER BUSINESS NAME'}>
          <TextInput
            label="Counterparty business name"
            value={deal.sellerName}
            onChange={(v) => deal.set('sellerName', v)}
          />
        </Field>

        <Field label="COUNTRY">
          <SelectBox label="Country" value={deal.country} />
        </Field>

        <Field
          label="THEIR CONTACT"
          hint="They'll get a link. No app, no account needed until they accept."
        >
          <TextInput
            label="Their contact"
            mono
            inputMode="tel"
            value={deal.contact}
            onChange={(v) => deal.set('contact', v)}
          />
        </Field>

        <div className="spacer">
          <PrimaryButton onClick={() => navigate('/deal/new/terms')}>
            Next — terms
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
