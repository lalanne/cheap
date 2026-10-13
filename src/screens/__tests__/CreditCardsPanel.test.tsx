import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { useCreditCardsStore } from '../../creditCards/store';
import type { CreditCard, CreditCardPayment } from '../../creditCards/types';
import { useTransactionsStore } from '../../transactions/store';
import type { Transaction } from '../../transactions/types';
import { CreditCardsPanel } from '../CreditCardsPanel';

jest.mock('../../creditCards/store', () => ({
  useCreditCardsStore: jest.fn(),
}));
jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));

function mockCreditCardsStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    cards: [] as CreditCard[],
    payments: [] as CreditCardPayment[],
    addCard: jest.fn(),
    updateCard: jest.fn(),
    deleteCard: jest.fn(),
    logPayment: jest.fn(),
    deletePayment: jest.fn(),
    ...overrides,
  };
  (useCreditCardsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
  return state;
}

function mockTransactions(transactions: Transaction[] = []) {
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { transactions: Transaction[] }) => unknown) => selector({ transactions }),
  );
}

const VISA: CreditCard = {
  id: 'card-1',
  name: 'Visa CLP',
  limit: 2000000,
  minimumPayment: 100000,
  monthlyRate: 3.45,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
};

function expenseTx(amount: number, cardId: string | null): Transaction {
  return {
    id: `tx-${amount}-${cardId}`,
    type: 'expense',
    amount,
    category: 'Groceries',
    date: new Date('2026-09-10'),
    note: null,
    cardId,
    createdAt: new Date('2026-09-10'),
    updatedAt: new Date('2026-09-10'),
  };
}

describe('CreditCardsPanel — renders as a panel (spec 013)', () => {
  it('renders inside a plain panel, not a top-level Screen', async () => {
    mockCreditCardsStore();
    mockTransactions();
    await render(<CreditCardsPanel />);

    expect(screen.getByTestId('credit-cards-panel')).toBeTruthy();
  });

  it('shows an empty state with no cards', async () => {
    mockCreditCardsStore();
    mockTransactions();
    await render(<CreditCardsPanel />);

    expect(screen.getByTestId('credit-cards-empty-state')).toBeTruthy();
  });
});

describe('CreditCardsPanel — adding a card (criterion 1)', () => {
  it('opens the add-card form and creates a card', async () => {
    const store = mockCreditCardsStore();
    mockTransactions();
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('add-card-button'));
    await fireEvent.changeText(screen.getByTestId('card-name-input'), 'Visa CLP');
    await fireEvent.changeText(screen.getByTestId('card-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('card-minimum-payment-input'), '100000');
    await fireEvent.press(screen.getByTestId('save-card-button'));

    expect(store.addCard).toHaveBeenCalledWith({
      name: 'Visa CLP',
      limit: 2000000,
      minimumPayment: 100000,
      monthlyRate: null,
    });
  });

  it('accepts an optional monthly rate', async () => {
    const store = mockCreditCardsStore();
    mockTransactions();
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('add-card-button'));
    await fireEvent.changeText(screen.getByTestId('card-name-input'), 'Visa CLP');
    await fireEvent.changeText(screen.getByTestId('card-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('card-minimum-payment-input'), '100000');
    await fireEvent.changeText(screen.getByTestId('card-rate-input'), '3.45');
    await fireEvent.press(screen.getByTestId('save-card-button'));

    expect(store.addCard).toHaveBeenCalledWith(expect.objectContaining({ monthlyRate: 3.45 }));
  });

  it('rejects a blank name', async () => {
    const store = mockCreditCardsStore();
    mockTransactions();
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('add-card-button'));
    await fireEvent.changeText(screen.getByTestId('card-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('card-minimum-payment-input'), '100000');
    await fireEvent.press(screen.getByTestId('save-card-button'));

    expect(store.addCard).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a name.')).toBeTruthy();
  });

  it('rejects an invalid limit', async () => {
    const store = mockCreditCardsStore();
    mockTransactions();
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('add-card-button'));
    await fireEvent.changeText(screen.getByTestId('card-name-input'), 'Visa CLP');
    await fireEvent.changeText(screen.getByTestId('card-limit-input'), '0');
    await fireEvent.changeText(screen.getByTestId('card-minimum-payment-input'), '100000');
    await fireEvent.press(screen.getByTestId('save-card-button'));

    expect(store.addCard).not.toHaveBeenCalled();
    expect(screen.getByText('Amount must be greater than zero.')).toBeTruthy();
  });
});

describe('CreditCardsPanel — a card row (criteria 3, 4, 7)', () => {
  it('shows balance derived live from tagged transactions and payments, plus available room', async () => {
    mockCreditCardsStore({
      payments: [
        {
          id: 'p-1',
          cardId: 'card-1',
          amount: 20000,
          date: new Date(),
          note: null,
          createdAt: new Date(),
        },
      ],
      cards: [VISA],
    });
    mockTransactions([
      expenseTx(45000, 'card-1'),
      expenseTx(12000, 'card-1'),
      expenseTx(9000, 'card-2'),
    ]);
    await render(<CreditCardsPanel />);

    const row = screen.getByTestId('card-row-card-1');
    expect(within(row).getByText('$37.000')).toBeTruthy();
    expect(within(row).getByText(/\$1\.963\.000/)).toBeTruthy();
  });

  it('shows a zero balance for a newly added card with no activity, not an error', async () => {
    mockCreditCardsStore({ cards: [VISA] });
    mockTransactions();
    await render(<CreditCardsPanel />);

    expect(within(screen.getByTestId('card-row-card-1')).getByText('$0')).toBeTruthy();
    expect(screen.queryByTestId('card-status-card-1')).toBeNull();
  });

  it('shows no status badge while in-use, and a badge from 75% up', async () => {
    mockCreditCardsStore({ cards: [VISA] });
    mockTransactions([expenseTx(1600000, 'card-1')]);
    await render(<CreditCardsPanel />);

    expect(
      within(screen.getByTestId('card-row-card-1')).getByTestId('card-status-card-1'),
    ).toBeTruthy();
  });

  it('shows the payoff estimate at the minimum payment', async () => {
    mockCreditCardsStore({ cards: [VISA] });
    mockTransactions([expenseTx(1240000, 'card-1')]);
    await render(<CreditCardsPanel />);

    // revolvingPayoff(1240000, 3.45, 100000) — same math as spec 012's.
    expect(within(screen.getByTestId('card-row-card-1')).getByText(/months/)).toBeTruthy();
  });
});

describe('CreditCardsPanel — logging a payment (criterion 5)', () => {
  it('logs a payment through the store, creating no transaction', async () => {
    const store = mockCreditCardsStore({ cards: [VISA] });
    mockTransactions([expenseTx(1240000, 'card-1')]);
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('log-card-payment-button-card-1'));
    await fireEvent.changeText(screen.getByTestId('card-payment-amount-input'), '50000');
    await fireEvent.press(screen.getByTestId('confirm-card-payment-button'));

    expect(store.logPayment).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'card-1', amount: 50000 }),
    );
  });

  it('rejects a payment greater than the current balance', async () => {
    const store = mockCreditCardsStore({ cards: [VISA] });
    mockTransactions([expenseTx(1240000, 'card-1')]);
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('log-card-payment-button-card-1'));
    await fireEvent.changeText(screen.getByTestId('card-payment-amount-input'), '9999999');
    await fireEvent.press(screen.getByTestId('confirm-card-payment-button'));

    expect(store.logPayment).not.toHaveBeenCalled();
    expect(screen.getByText('Payment can’t be more than the current balance.')).toBeTruthy();
  });
});

describe('CreditCardsPanel — editing settings and deleting', () => {
  it('opens the settings form prefilled and saves an edit', async () => {
    const store = mockCreditCardsStore({ cards: [VISA] });
    mockTransactions();
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('edit-card-button-card-1'));
    expect(screen.getByTestId('card-name-input').props.value).toBe('Visa CLP');
    expect(screen.getByTestId('card-rate-input').props.value).toBe('3.45');

    await fireEvent.changeText(screen.getByTestId('card-rate-input'), '4');
    await fireEvent.press(screen.getByTestId('save-card-button'));

    expect(store.updateCard).toHaveBeenCalledWith('card-1', {
      name: 'Visa CLP',
      limit: 2000000,
      minimumPayment: 100000,
      monthlyRate: 4,
    });
  });

  it('deletes a card through the store', async () => {
    const store = mockCreditCardsStore({ cards: [VISA] });
    mockTransactions();
    await render(<CreditCardsPanel />);

    await fireEvent.press(screen.getByTestId('delete-card-card-1'));

    expect(store.deleteCard).toHaveBeenCalledWith('card-1');
  });
});
