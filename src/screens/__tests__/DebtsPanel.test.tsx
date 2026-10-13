import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Debt } from '../../debts/types';
import { useDebtsStore } from '../../debts/store';
import { DebtsPanel } from '../DebtsPanel';

jest.mock('../../debts/store', () => ({
  useDebtsStore: jest.fn(),
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    debts: [] as Debt[],
    addDebt: jest.fn(),
    logPayment: jest.fn(),
    editBalance: jest.fn(),
    deleteDebt: jest.fn(),
    ...overrides,
  };
  (useDebtsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
  return state;
}

const EXISTING: Debt = {
  id: 'd-1',
  name: 'Credit Card',
  originalAmount: 2000000,
  currentBalance: 1200000,
  minimumPayment: 100000,
  interestRate: null,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
};

describe('DebtsPanel (spec 009 amendment: Manage tab, not its own screen)', () => {
  it('renders as a panel, not a top-level Screen', async () => {
    mockStore();
    await render(<DebtsPanel />);

    expect(screen.getByTestId('debts-panel')).toBeTruthy();
  });

  it('opens the add-debt form and creates a debt (criterion 1)', async () => {
    const store = mockStore();
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('add-debt-button'));
    await fireEvent.changeText(screen.getByTestId('debt-name-input'), 'Credit Card');
    await fireEvent.changeText(screen.getByTestId('debt-original-amount-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('debt-balance-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('debt-minimum-payment-input'), '100000');
    await fireEvent.press(screen.getByTestId('save-debt-button'));

    expect(store.addDebt).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Credit Card',
        originalAmount: 2000000,
        currentBalance: 2000000,
        minimumPayment: 100000,
      }),
    );
  });

  it('logs a payment through the store, not a direct balance edit (criterion 2)', async () => {
    const store = mockStore({ debts: [EXISTING] });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('log-payment-button-d-1'));
    await fireEvent.changeText(screen.getByTestId('payment-amount-input'), '50000');
    await fireEvent.press(screen.getByTestId('confirm-payment-button'));

    expect(store.logPayment).toHaveBeenCalledWith('d-1', 50000);
    expect(store.editBalance).not.toHaveBeenCalled();
  });

  it('rejects a payment greater than the current balance (criterion 5)', async () => {
    const store = mockStore({ debts: [EXISTING] });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('log-payment-button-d-1'));
    await fireEvent.changeText(screen.getByTestId('payment-amount-input'), '9999999');
    await fireEvent.press(screen.getByTestId('confirm-payment-button'));

    expect(store.logPayment).not.toHaveBeenCalled();
    expect(screen.getByText('Payment can’t be more than the current balance.')).toBeTruthy();
  });

  it('edits the balance directly without logging a payment (criterion 3)', async () => {
    const store = mockStore({ debts: [EXISTING] });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('edit-balance-button-d-1'));
    await fireEvent.changeText(screen.getByTestId('balance-amount-input'), '1000000');
    await fireEvent.press(screen.getByTestId('confirm-balance-button'));

    expect(store.editBalance).toHaveBeenCalledWith('d-1', 1000000);
    expect(store.logPayment).not.toHaveBeenCalled();
  });

  it('shows a paid-off debt and deletes it on request (criterion 6)', async () => {
    const paidOff: Debt = { ...EXISTING, currentBalance: 0 };
    const store = mockStore({ debts: [paidOff] });
    await render(<DebtsPanel />);

    expect(screen.getByTestId('debt-row-d-1')).toBeTruthy();
    expect(screen.getByText(/paid off/i)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('delete-debt-d-1'));

    expect(store.deleteDebt).toHaveBeenCalledWith('d-1');
  });

  it('shows an empty state when there are no debts', async () => {
    mockStore({ debts: [] });
    await render(<DebtsPanel />);

    expect(screen.getByTestId('debts-empty-state')).toBeTruthy();
  });
});
