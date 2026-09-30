import { createCreditCardsStore } from '../creditCardsStore';
import type {
  CreditCard,
  CreditCardPayment,
  CreditCardPaymentRepository,
  CreditCardRepository,
  LogCardPaymentInput,
  NewCreditCardInput,
} from '../types';

function createMockRepos() {
  let cards: CreditCard[] = [];
  let payments: CreditCardPayment[] = [];
  let cardListener: ((c: CreditCard[]) => void) | null = null;
  let paymentListener: ((p: CreditCardPayment[]) => void) | null = null;
  const unsubscribeCards = jest.fn(() => {
    cardListener = null;
  });
  const unsubscribePayments = jest.fn(() => {
    paymentListener = null;
  });
  let nextId = 1;

  const cardsRepo: CreditCardRepository = {
    subscribe: jest.fn((callback) => {
      cardListener = callback;
      callback(cards);
      return unsubscribeCards;
    }),
    create: jest.fn(async (input: NewCreditCardInput) => {
      const now = new Date();
      const card: CreditCard = {
        id: `card-${nextId++}`,
        name: input.name,
        limit: input.limit,
        minimumPayment: input.minimumPayment,
        monthlyRate: input.monthlyRate ?? null,
        createdAt: now,
        updatedAt: now,
      };
      cards = [...cards, card];
      cardListener?.(cards);
      return card;
    }),
    update: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
  };

  const paymentsRepo: CreditCardPaymentRepository = {
    subscribe: jest.fn((callback) => {
      paymentListener = callback;
      callback(payments);
      return unsubscribePayments;
    }),
    logPayment: jest.fn(async () => {}),
    deletePayment: jest.fn(async () => {}),
  };

  return {
    cards: cardsRepo,
    payments: paymentsRepo,
    unsubscribeCards,
    unsubscribePayments,
    emitPayments: (p: CreditCardPayment[]) => paymentListener?.(p),
  };
}

const PAYMENT: LogCardPaymentInput = { cardId: 'card-1', amount: 50000, date: new Date('2026-09-24'), note: null };

describe('creditCardsStore', () => {
  it('does not touch the repositories until startSync is called', () => {
    const repos = createMockRepos();
    createCreditCardsStore(repos);

    expect(repos.cards.subscribe).not.toHaveBeenCalled();
    expect(repos.payments.subscribe).not.toHaveBeenCalled();
  });

  it('swallows a repository that throws when starting sync, instead of crashing', () => {
    const repos = createMockRepos();
    (repos.cards.subscribe as jest.Mock).mockImplementation(() => {
      throw new Error('native bridge not ready');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { startSync } = createCreditCardsStore(repos);

    expect(() => startSync()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('mirrors cards and payments from the repositories once sync starts', () => {
    const repos = createMockRepos();
    const { useCreditCardsStore, startSync } = createCreditCardsStore(repos);
    startSync();

    expect(useCreditCardsStore.getState().cards).toEqual([]);
    expect(useCreditCardsStore.getState().payments).toEqual([]);

    const payment: CreditCardPayment = {
      id: 'p-1',
      cardId: 'card-1',
      amount: 50000,
      date: new Date('2026-09-24'),
      note: null,
      createdAt: new Date('2026-09-24'),
    };
    repos.emitPayments([payment]);

    expect(useCreditCardsStore.getState().payments).toEqual([payment]);
  });

  it('stops both listeners when the returned unsubscribe runs', () => {
    const repos = createMockRepos();
    const { startSync } = createCreditCardsStore(repos);

    startSync()();

    expect(repos.unsubscribeCards).toHaveBeenCalled();
    expect(repos.unsubscribePayments).toHaveBeenCalled();
  });

  it('adds a card through the repository (criterion 1)', async () => {
    const repos = createMockRepos();
    const { useCreditCardsStore, startSync } = createCreditCardsStore(repos);
    startSync();

    await useCreditCardsStore.getState().addCard({ name: 'Visa CLP', limit: 2000000, minimumPayment: 100000 });

    expect(repos.cards.create).toHaveBeenCalledWith({ name: 'Visa CLP', limit: 2000000, minimumPayment: 100000 });
    expect(useCreditCardsStore.getState().cards).toHaveLength(1);
  });

  it('updates a card through the repository', async () => {
    const repos = createMockRepos();
    const { useCreditCardsStore } = createCreditCardsStore(repos);

    await useCreditCardsStore.getState().updateCard('card-1', { monthlyRate: 3.45 });

    expect(repos.cards.update).toHaveBeenCalledWith('card-1', { monthlyRate: 3.45 });
  });

  it('deletes a card through the repository', async () => {
    const repos = createMockRepos();
    const { useCreditCardsStore } = createCreditCardsStore(repos);

    await useCreditCardsStore.getState().deleteCard('card-1');

    expect(repos.cards.delete).toHaveBeenCalledWith('card-1');
  });

  it('logs a payment through the payments repository, not the cards one (criterion 5)', async () => {
    const repos = createMockRepos();
    const { useCreditCardsStore } = createCreditCardsStore(repos);

    await useCreditCardsStore.getState().logPayment(PAYMENT);

    expect(repos.payments.logPayment).toHaveBeenCalledWith(PAYMENT);
    expect(repos.cards.update).not.toHaveBeenCalled();
  });

  it('deletes a payment through the payments repository', async () => {
    const repos = createMockRepos();
    const { useCreditCardsStore } = createCreditCardsStore(repos);

    await useCreditCardsStore.getState().deletePayment('p-1');

    expect(repos.payments.deletePayment).toHaveBeenCalledWith('p-1');
  });
});
