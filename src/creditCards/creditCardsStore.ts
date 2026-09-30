import { create } from 'zustand';

import type {
  CreditCard,
  CreditCardPatch,
  CreditCardPayment,
  CreditCardPaymentRepository,
  CreditCardRepository,
  LogCardPaymentInput,
  NewCreditCardInput,
} from './types';

type CreditCardsState = {
  cards: CreditCard[];
  payments: CreditCardPayment[];
};

type CreditCardsActions = {
  addCard: (input: NewCreditCardInput) => Promise<void>;
  updateCard: (id: string, patch: CreditCardPatch) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  logPayment: (input: LogCardPaymentInput) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;
};

export type CreditCardsStore = CreditCardsState & CreditCardsActions;

export type CreditCardsRepositories = {
  cards: CreditCardRepository;
  payments: CreditCardPaymentRepository;
};

export function createCreditCardsStore(repos: CreditCardsRepositories) {
  const useCreditCardsStore = create<CreditCardsStore>()(() => ({
    cards: [],
    payments: [],

    addCard: async (input) => {
      await repos.cards.create(input);
    },
    updateCard: async (id, patch) => {
      await repos.cards.update(id, patch);
    },
    deleteCard: async (id) => {
      await repos.cards.delete(id);
    },
    // Deliberately separate from the cards repository — a payment is not
    // an expense and touches no transaction (spec 013 criterion 5).
    logPayment: async (input) => {
      await repos.payments.logPayment(input);
    },
    deletePayment: async (id) => {
      await repos.payments.deletePayment(id);
    },
  }));

  // Deferred, not called here — same reasoning as every other store in
  // this app (debtsStore.ts, overdraftStore.ts): touching the native
  // Firestore bridge at module-load time is suspected to cause a real
  // launch crash.
  function startSync(): () => void {
    let unsubscribeCards = () => {};
    let unsubscribePayments = () => {};
    try {
      unsubscribeCards = repos.cards.subscribe((cards) => {
        useCreditCardsStore.setState({ cards });
      });
      unsubscribePayments = repos.payments.subscribe((payments) => {
        useCreditCardsStore.setState({ payments });
      });
    } catch (e) {
      console.warn('[creditCardsStore] failed to start sync', e);
    }
    return () => {
      unsubscribeCards();
      unsubscribePayments();
    };
  }

  return { useCreditCardsStore, startSync };
}
