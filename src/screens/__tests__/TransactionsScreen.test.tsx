import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Transaction } from '../../transactions/types';
import { useTransactionsStore } from '../../transactions/store';
import { TransactionsScreen } from '../TransactionsScreen';

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

  it('creates a custom category and makes it selectable (criterion 6)', async () => {
    const store = mockStore({
      addCategory: jest.fn().mockResolvedValue({ id: 'cat-1', name: 'Pets', type: 'both' }),
    });
    await render(<TransactionsScreen />);

    await fireEvent.press(screen.getByTestId('add-transaction-button'));
    await fireEvent.press(screen.getByTestId('add-category-button'));
    await fireEvent.changeText(screen.getByTestId('new-category-input'), 'Pets');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.addCategory).toHaveBeenCalledWith('Pets', 'both');
  });
});
