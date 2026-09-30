import { createCreditCardsStore } from './creditCardsStore';
import { firestoreCreditCardRepository } from './providers/firestoreCreditCardRepository';
import { firestoreCreditCardPaymentRepository } from './providers/firestoreCreditCardPaymentRepository';

const { useCreditCardsStore, startSync } = createCreditCardsStore({
  cards: firestoreCreditCardRepository,
  payments: firestoreCreditCardPaymentRepository,
});

export { useCreditCardsStore };
// Called from App.tsx inside a useEffect, not here — see creditCardsStore.ts.
export const startCreditCardsSync = startSync;
