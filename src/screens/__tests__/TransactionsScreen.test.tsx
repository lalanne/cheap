import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import type { Transaction } from '../../transactions/types';
import { useTransactionsStore } from '../../transactions/store';
import { TransactionsScreen } from '../TransactionsScreen';
import { colors } from '../../theme/tokens';

function flatten(style: unknown) {
  return StyleSheet.flatten(style as never) as Record<string, unknown>;
}

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
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

describe('TransactionsScreen', () => {
  it('opens the add-transaction form and creates a valid expense (criterion 1)', async () => {
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

  it('rejects an invalid amount without calling the store (criterion 2)', async () => {
    const store = mockStore();
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    await fireEvent.changeText(screen.getByTestId('amount-input'), '1500.50');
    await fireEvent.press(screen.getByTestId('save-transaction-button'));

    expect(store.addTransaction).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a whole number in pesos — no decimals or symbols.')).toBeTruthy();
  });

  it('edits an existing transaction in place (criterion 3)', async () => {
    const store = mockStore({ transactions: [EXISTING] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId(`transaction-row-${EXISTING.id}`));
    await fireEvent.changeText(screen.getByTestId('amount-input'), '50000');
    await fireEvent.press(screen.getByTestId('save-transaction-button'));

    expect(store.updateTransaction).toHaveBeenCalledWith(
      EXISTING.id,
      expect.objectContaining({ amount: 50000 })
    );
  });

  it('deletes a transaction (criterion 4)', async () => {
    const store = mockStore({ transactions: [EXISTING] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId(`delete-transaction-${EXISTING.id}`));

    expect(store.deleteTransaction).toHaveBeenCalledWith(EXISTING.id);
  });

  it('renders transactions in the order the store provides (criterion 5 is a store concern)', async () => {
    const other: Transaction = { ...EXISTING, id: 'tx-2', category: 'Transport' };
    mockStore({ transactions: [other, EXISTING] });
    await render(<TransactionsScreen />);

    const rows = screen.getAllByTestId(/^transaction-row-/);
    expect(rows[0].props.testID).toBe('transaction-row-tx-2');
    expect(rows[1].props.testID).toBe('transaction-row-tx-1');
  });

  it('shows an error instead of failing silently when save throws (regression: native Firestore split-brain auth bug)', async () => {
    const store = mockStore({
      addTransaction: jest.fn().mockRejectedValue(new Error('No signed-in user — cannot access transactions.')),
    });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    await fireEvent.changeText(screen.getByTestId('amount-input'), '45000');
    await fireEvent.press(screen.getByTestId('category-chip-Food'));
    await fireEvent.press(screen.getByTestId('save-transaction-button'));

    expect(store.addTransaction).toHaveBeenCalled();
    expect(screen.getByTestId('save-error')).toBeTruthy();
    expect(screen.getByText('No signed-in user — cannot access transactions.')).toBeTruthy();
    expect(screen.getByTestId('transaction-form')).toBeTruthy();
  });

  it('highlights the selected Expense/Income tab with a solid accent fill (design option B)', async () => {
    mockStore();
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));

    expect(flatten(screen.getByTestId('type-expense').props.style).backgroundColor).toBe(colors.accent);
    expect(flatten(screen.getByTestId('type-income').props.style).backgroundColor).not.toBe(colors.accent);

    await fireEvent.press(screen.getByTestId('type-income'));

    expect(flatten(screen.getByTestId('type-income').props.style).backgroundColor).toBe(colors.accent);
    expect(flatten(screen.getByTestId('type-expense').props.style).backgroundColor).not.toBe(colors.accent);
  });

  it('creates a custom category and makes it selectable (criterion 6)', async () => {
    const store = mockStore({
      addCategory: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Pets', type: 'both', parentCategory: null }),
    });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    await fireEvent.press(screen.getByTestId('add-category-button'));
    await fireEvent.changeText(screen.getByTestId('new-category-input'), 'Pets');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.addCategory).toHaveBeenCalledWith('Pets', 'both', null);
  });
});

describe('TransactionsScreen — grouped by month (spec 002 2026-09-25 amendment)', () => {
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
  const septIncomeTx: Transaction = {
    ...septTx,
    id: 'tx-sep-income',
    type: 'income',
    amount: 1450000,
    date: new Date(2026, 8, 23),
  };
  const augTx: Transaction = {
    ...septTx,
    id: 'tx-aug',
    date: new Date(2026, 7, 30),
    category: 'Housing',
    amount: 350000,
  };

  it('shows a header per month with the month name and its expense-only total (criterion 12)', async () => {
    mockStore({ transactions: [septIncomeTx, septTx, augTx] });
    await render(<TransactionsScreen />);

    const septHeader = screen.getByTestId('transaction-month-header-2026-9');
    expect(within(septHeader).getByText('September 2026')).toBeTruthy();
    expect(within(septHeader).getByText(/\$4\.500/)).toBeTruthy();

    const augHeader = screen.getByTestId('transaction-month-header-2026-8');
    expect(within(augHeader).getByText('August 2026')).toBeTruthy();
    expect(within(augHeader).getByText(/\$350\.000/)).toBeTruthy();
  });

  it('lists each month in order, most recent first, rows within a month unchanged', async () => {
    mockStore({ transactions: [septTx, augTx] });
    await render(<TransactionsScreen />);

    const testIDs = screen.getAllByTestId(/^transaction-(month-header|row)-/).map((el) => el.props.testID);
    expect(testIDs).toEqual([
      'transaction-month-header-2026-9',
      'transaction-row-tx-sep',
      'transaction-month-header-2026-8',
      'transaction-row-tx-aug',
    ]);
  });

  it('shows an abbreviated date on each row instead of the full ISO string', async () => {
    mockStore({ transactions: [septTx] });
    await render(<TransactionsScreen />);

    const row = screen.getByTestId('transaction-row-tx-sep');
    expect(within(row).getByText(/Sep 22/)).toBeTruthy();
    expect(within(row).queryByText('2026-09-22')).toBeNull();
  });

  it('marks the month header as sticky on web', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'web';
    try {
      mockStore({ transactions: [septTx] });
      await render(<TransactionsScreen />);

      expect(flatten(screen.getByTestId('transaction-month-header-2026-9').props.style).position).toBe('sticky');
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('does not mark the month header as sticky on native', async () => {
    mockStore({ transactions: [septTx] });
    await render(<TransactionsScreen />);

    expect(flatten(screen.getByTestId('transaction-month-header-2026-9').props.style).position).not.toBe('sticky');
  });
});

describe('TransactionsScreen — Add moves beside each month (spec 002 2026-09-25 amendment, narrow/native)', () => {
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
  const augTx: Transaction = { ...septTx, id: 'tx-aug', date: new Date(2026, 7, 30) };

  it('shows no page-level Add button once there is at least one transaction (criterion 14)', async () => {
    mockStore({ transactions: [septTx] });
    await render(<TransactionsScreen />);

    expect(screen.queryByTestId('add-transaction-button')).toBeNull();
  });

  it("opens the form from a month's own Add button, same defaults as before (criterion 14)", async () => {
    mockStore({ transactions: [septTx, augTx] });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button-2026-8'));

    expect(screen.getByTestId('transaction-form')).toBeTruthy();
    expect(screen.getByTestId('type-expense')).toBeTruthy();
  });

  it('shows an empty-state message with its own Add button when there are no transactions (criterion 15)', async () => {
    const store = mockStore();
    await render(<TransactionsScreen />);

    expect(screen.getByText(/no transactions yet/i)).toBeTruthy();
    const addButton = screen.getByTestId('add-transaction-button');

    await fireEvent.press(addButton);
    await fireEvent.changeText(screen.getByTestId('amount-input'), '45000');
    await fireEvent.press(screen.getByTestId('category-chip-Food'));
    await fireEvent.press(screen.getByTestId('save-transaction-button'));

    expect(store.addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', amount: 45000, category: 'Food' })
    );
  });
});
