import { useNavigate } from 'react-router-dom'
import { Content, NavBar, Screen, StatusBar, Title } from '@/components/Screen'
import { PrimaryButton } from '@/components/Button'
import { Field, SelectBox, TextInput } from '@/components/Field'
import { Segmented } from '@/components/Choice'
import { useDraft } from '@/state/DraftContext'

/** 04 — Counterparty. Side comes first, because it drives everything after. */
export function NewDealCounterparty() {
  const navigate = useNavigate()
  const { draft, set } = useDraft()

  const ready = draft.counterpartyName.trim() !== '' && draft.counterpartyContact.trim() !== ''

  return (
    <Screen label="New deal — counterparty">
      <StatusBar />
      <NavBar label="NEW DEAL · 1 OF 3" onBack={() => navigate('/deals')} />
      <Content gap={26}>
        <Title size={32}>Who are you trading with?</Title>

        <Segmented
          label="Which side of this trade are you on?"
          value={draft.side}
          onChange={(id) => set('side', id as typeof draft.side)}
          options={[
            { id: 'BUYING', label: "I'm buying" },
            { id: 'SELLING', label: "I'm selling" },
          ]}
        />

        <Field
          label={draft.side === 'BUYING' ? 'SELLER BUSINESS NAME' : 'BUYER BUSINESS NAME'}
        >
          <TextInput
            label="Counterparty business name"
            value={draft.counterpartyName}
            onChange={(v) => set('counterpartyName', v)}
            placeholder="Al Habib Auto Parts LLC"
          />
        </Field>

        <Field label="COUNTRY">
          <SelectBox
            label="Country"
            value={draft.counterpartyCountry === 'AE' ? 'United Arab Emirates' : draft.counterpartyCountry}
          />
        </Field>

        <Field
          label="THEIR CONTACT"
          hint="They'll get a link. No app, no account needed until they accept."
        >
          <TextInput
            label="Their contact"
            mono
            inputMode="tel"
            value={draft.counterpartyContact}
            onChange={(v) => set('counterpartyContact', v)}
            placeholder="+971 50 448 2210"
          />
        </Field>

        <div className="spacer">
          <PrimaryButton disabled={!ready} onClick={() => navigate('/deal/new/terms')}>
            Next — terms
          </PrimaryButton>
        </div>
      </Content>
    </Screen>
  )
}
