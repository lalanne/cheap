import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { Debt } from '../../debts/types';
import { useDebtsStore } from '../../debts/store';
import { DebtsPanel } from '../DebtsPanel';

jest.mock('../../debts/store', () => ({
  useDebtsStore: jest.fn(),
}));

// Pass-through that records each Button's latest onPress, so a test can
// fire two presses inside one act() — the #70 race, where the second tap
// lands before React re-renders. Two overlapping fireEvent calls would be
// overlapping act()s, which RNTL doesn't support.
const mockButtonPresses: Record<string, () => Promise<void> | void> = {};
jest.mock('../../components/Button', () => {
  const React = jest.requireActual('react');
  const { Button: RealButton } = jest.requireActual('../../components/Button');
  return {
    Button: (props: { testID?: string; onPress?: () => Promise<void> | void }) => {
      if (props.testID && props.onPress) {
        mockButtonPresses[props.testID] = props.onPress;
      }
      return React.createElement(RealButton, props);
    },
  };
});

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

  it('shows an inline error and keeps the form open when the debt name collides with a category (criterion 13)', async () => {
    const store = mockStore({
      addDebt: jest.fn().mockRejectedValue(new Error('A category with this name already exists.')),
    });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('add-debt-button'));
    await fireEvent.changeText(screen.getByTestId('debt-name-input'), 'Food');
    await fireEvent.changeText(screen.getByTestId('debt-original-amount-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('debt-balance-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('debt-minimum-payment-input'), '100000');
    await fireEvent.press(screen.getByTestId('save-debt-button'));

    expect(store.addDebt).toHaveBeenCalled();
    expect(await screen.findByText('A category with this name already exists.')).toBeTruthy();
    expect(screen.getByTestId('save-debt-button')).toBeTruthy();
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

  // Issue #70 — on iOS a second tap on Confirm landed while the first
  // logPayment was still in flight, writing two expense transactions for
  // one payment. A pending submit must swallow further presses.
  it('logs a payment only once when Confirm is pressed twice while the first is pending (#70)', async () => {
    let resolvePayment: () => void = () => {};
    const logPayment = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePayment = resolve;
        }),
    );
    mockStore({ debts: [EXISTING], logPayment });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('log-payment-button-d-1'));
    await fireEvent.changeText(screen.getByTestId('payment-amount-input'), '100000');
    const confirm = mockButtonPresses['confirm-payment-button'];
    await act(async () => {
      // Both taps land before the first save settles or React re-renders.
      const first = confirm();
      const second = confirm();
      resolvePayment();
      await Promise.all([first, second]);
    });

    expect(logPayment).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('payment-form')).toBeNull();
  });

  it('marks Confirm payment disabled while the payment is pending (#70)', async () => {
    let resolvePayment: () => void = () => {};
    const logPayment = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePayment = resolve;
        }),
    );
    mockStore({ debts: [EXISTING], logPayment });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('log-payment-button-d-1'));
    await fireEvent.changeText(screen.getByTestId('payment-amount-input'), '100000');
    let pending: Promise<void> | void = undefined;
    await act(async () => {
      pending = mockButtonPresses['confirm-payment-button']();
    });

    expect(screen.getByTestId('confirm-payment-button')).toBeDisabled();

    await act(async () => {
      resolvePayment();
      await pending;
    });
  });

  it('shows an inline error and allows a retry after a failed payment (#70)', async () => {
    const logPayment = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    mockStore({ debts: [EXISTING], logPayment });
    await render(<DebtsPanel />);

    await fireEvent.press(screen.getByTestId('log-payment-button-d-1'));
    await fireEvent.changeText(screen.getByTestId('payment-amount-input'), '100000');
    await fireEvent.press(screen.getByTestId('confirm-payment-button'));

    expect(screen.getByTestId('payment-form')).toBeTruthy();
    expect(screen.getByText('Could not log the payment. Try again.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('confirm-payment-button'));

    expect(logPayment).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('payment-form')).toBeNull();
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
