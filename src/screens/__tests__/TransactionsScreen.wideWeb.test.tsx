import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Transaction } from '../../transactions/types';
import { useTransactionsStore } from '../../transactions/store';
import { TransactionsScreen } from '../TransactionsScreen';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));

jest.mock('../../theme/useWideWeb', () => ({
  useWideWeb: () => true,
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    transactions: [] as Transaction[],
    categories: [],
    addTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    deleteTransaction: jest.fn(),
    addCategory: jest.fn(),
    ...overrides,
  };
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  return state;
}

const EXISTING: Transaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 45000,
  category: 'Food',
  date: new Date('2026-09-15'),
  note: 'Groceries',
  createdAt: new Date('2026-09-15'),
  updatedAt: new Date('2026-09-15'),
};

describe('TransactionsScreen (wide web, spec 006)', () => {
  it('shows the list and an empty-state prompt when no form is open (criterion 2)', async () => {
    mockStore({ transactions: [EXISTING] });
    await render(<TransactionsScreen />);

    expect(screen.getByTestId('transaction-row-tx-1')).toBeTruthy();
    expect(screen.getByTestId('wide-empty-state')).toBeTruthy();
    expect(screen.queryByTestId('transaction-form')).toBeNull();
  });

  it('keeps the list visible next to the form once it opens (criterion 3)', async () => {
    mockStore({ transactions: [EXISTING] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));

    expect(screen.getByTestId('transaction-row-tx-1')).toBeTruthy();
    expect(screen.getByTestId('transaction-form')).toBeTruthy();
    expect(screen.queryByTestId('wide-empty-state')).toBeNull();
  });

  it('renders Amount and Date in the same row (criterion 4)', async () => {
    mockStore();
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));

    const row = screen.getByTestId('amount-date-row');
    expect(within(row).getByTestId('amount-input')).toBeTruthy();
    expect(within(row).getByTestId('date-input')).toBeTruthy();
  });

  it('still creates a transaction correctly from the split layout', async () => {
    const store = mockStore();
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    await fireEvent.changeText(screen.getByTestId('amount-input'), '45000');
    await fireEvent.press(screen.getByTestId('category-chip-Food'));
    await fireEvent.press(screen.getByTestId('save-transaction-button'));

    expect(store.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', amount: 45000, category: 'Food' })
    );
  });
});

describe('TransactionsScreen — month rail (wide web, spec 006 2026-09-25 amendment)', () => {
  const septTx: Transaction = {
    id: 'tx-sep',
    type: 'expense',
    amount: 4500,
    category: 'Food',
    date: new Date(2026, 8, 22),
    note: null,
    createdAt: new Date(2026, 8, 22),
    updatedAt: new Date(2026, 8, 22),
  };
  const augTx: Transaction = {
    ...septTx,
    id: 'tx-aug',
    date: new Date(2026, 7, 30),
    category: 'Housing',
    amount: 350000,
  };

  it('lists every month with a transaction, most recent first, with its spend total (criterion 8)', async () => {
    mockStore({ transactions: [septTx, augTx] });
    await render(<TransactionsScreen />);

    const rail = screen.getByTestId('month-rail');
    const items = within(rail).getAllByTestId(/^month-rail-item-/);
    expect(items.map((el) => el.props.testID)).toEqual(['month-rail-item-2026-9', 'month-rail-item-2026-8']);
    expect(within(items[0]).getByText(/\$4\.500/)).toBeTruthy();
    expect(within(items[1]).getByText(/\$350\.000/)).toBeTruthy();
  });

  it('defaults to the most recent month, with an Add button beside its name (criterion 8)', async () => {
    mockStore({ transactions: [septTx, augTx] });
    await render(<TransactionsScreen />);

    expect(within(screen.getByTestId('month-column')).getByText('September 2026')).toBeTruthy();
    expect(screen.getByTestId('add-transaction-button')).toBeTruthy();
    expect(screen.getByTestId('transaction-row-tx-sep')).toBeTruthy();
    expect(screen.queryByTestId('transaction-row-tx-aug')).toBeNull();
  });

  it('switches the month column when a different rail item is clicked, marking it selected (criterion 9)', async () => {
    mockStore({ transactions: [septTx, augTx] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('month-rail-item-2026-8'));

    expect(within(screen.getByTestId('month-column')).getByText('August 2026')).toBeTruthy();
    expect(screen.getByTestId('transaction-row-tx-aug')).toBeTruthy();
    expect(screen.queryByTestId('transaction-row-tx-sep')).toBeNull();
  });

  it("clicking a rail item doesn't disturb an already-open form (criterion 9)", async () => {
    mockStore({ transactions: [septTx, augTx] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    expect(screen.getByTestId('transaction-form')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('month-rail-item-2026-8'));

    expect(screen.getByTestId('transaction-form')).toBeTruthy();
    expect(screen.getByTestId('transaction-row-tx-aug')).toBeTruthy();
  });

  it('shows an empty rail and a "no transactions yet" prompt instead of a month when there are none (criterion 9)', async () => {
    mockStore();
    await render(<TransactionsScreen />);

    expect(screen.queryAllByTestId(/^month-rail-item-/)).toHaveLength(0);
    expect(screen.getByText(/no transactions yet/i)).toBeTruthy();
    expect(screen.getByTestId('add-transaction-button')).toBeTruthy();
  });
});
