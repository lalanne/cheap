import { fireEvent, render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { useAuthStore } from '../auth/store';
import { startBudgetsSync, useBudgetsStore } from '../budgets/store';
import { startDebtsSync, useDebtsStore } from '../debts/store';
import { startOverdraftSync, useOverdraftStore } from '../overdraft/store';
import { startTransactionsSync, useTransactionsStore } from '../transactions/store';
import App from '../../App';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

jest.mock('../auth/store', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
  startTransactionsSync: jest.fn(() => () => {}),
}));

jest.mock('../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
  startBudgetsSync: jest.fn(() => () => {}),
}));

jest.mock('../debts/store', () => ({
  useDebtsStore: jest.fn(),
  startDebtsSync: jest.fn(() => () => {}),
}));

jest.mock('../overdraft/store', () => ({
  useOverdraftStore: jest.fn(),
  startOverdraftSync: jest.fn(() => () => {}),
}));

function mockAuthState(state: {
  status: 'initializing' | 'signedOut' | 'signedIn';
  user?: { emailVerified: boolean } | null;
}) {
  const fullState = {
    status: state.status,
    user: state.user ?? null,
    signInWithGoogle: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    sendPasswordReset: jest.fn(),
    resendVerificationEmail: jest.fn(),
    refreshEmailVerified: jest.fn(),
    signOut: jest.fn(),
  };
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector: (s: typeof fullState) => unknown) =>
    selector(fullState)
  );
}

describe('App', () => {
  function mockOverdraft(line: object | null, events: object[]) {
    const overdraftState = {
      line,
      events,
      setupLine: jest.fn(),
      updateLine: jest.fn(),
      logDraw: jest.fn(),
      logPayment: jest.fn(),
      logInterest: jest.fn(),
      logFee: jest.fn(),
      deleteEvent: jest.fn(),
    };
    (useOverdraftStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: typeof overdraftState) => unknown) => selector(overdraftState)
    );
  }

  beforeEach(() => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);
    mockOverdraft(null, []);
    const transactionsState = {
      transactions: [],
      categories: [],
      addTransaction: jest.fn(),
      updateTransaction: jest.fn(),
      deleteTransaction: jest.fn(),
      addCategory: jest.fn(),
      deleteCategory: jest.fn(),
    };
    (useTransactionsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: typeof transactionsState) => unknown) => selector(transactionsState)
    );
    const budgetsState = { budgets: [], setBudget: jest.fn(), deleteBudget: jest.fn() };
    (useBudgetsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: typeof budgetsState) => unknown) => selector(budgetsState)
    );
    const debtsState = { debts: [], addDebt: jest.fn(), logPayment: jest.fn(), editBalance: jest.fn(), deleteDebt: jest.fn() };
    (useDebtsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: typeof debtsState) => unknown) => selector(debtsState)
    );
  });

  it('shows a loading state while fonts are loading (spec 003, criterion 2)', async () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);
    mockAuthState({ status: 'initializing' });

    await render(<App />);

    expect(screen.getByTestId('loading-screen')).toBeTruthy();
  });

  it('shows the sign-in screen when signed out', async () => {
    mockAuthState({ status: 'signedOut' });

    await render(<App />);

    expect(screen.getByTestId('sign-in-screen')).toBeTruthy();
  });

  it('shows the verify-email screen when signed in but unverified (criterion 3)', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: false } });

    await render(<App />);

    expect(screen.getByTestId('verify-email-screen')).toBeTruthy();
  });

  it('shows the main app (transactions screen) once signed in and verified', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(screen.getByTestId('main-app')).toBeTruthy();
    expect(screen.getByTestId('transactions-screen')).toBeTruthy();
  });

  it('starts transactions sync after mount, not at module load (regression: TestFlight launch crash)', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(startTransactionsSync).toHaveBeenCalled();
  });

  it('starts budgets sync after mount too', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(startBudgetsSync).toHaveBeenCalled();
  });

  it('starts debts sync after mount too', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(startDebtsSync).toHaveBeenCalled();
  });

  it('starts overdraft sync after mount too', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(startOverdraftSync).toHaveBeenCalled();
  });

  it('shows exactly four tabs — Log, Overdraft, Manage, Dashboard — and switches screens (spec 009 amendment, spec 012 criterion 14)', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(screen.getByTestId('tab-transactions')).toBeTruthy();
    expect(screen.getByTestId('tab-overdraft')).toBeTruthy();
    expect(screen.getByTestId('tab-manage')).toBeTruthy();
    expect(screen.getByTestId('tab-dashboard')).toBeTruthy();
    expect(screen.queryByTestId('tab-categories')).toBeNull();
    expect(screen.queryByTestId('tab-budgets')).toBeNull();
    expect(screen.queryByTestId('tab-debts')).toBeNull();
    expect(screen.getByTestId('transactions-screen')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('tab-overdraft'));
    expect(screen.getByTestId('overdraft-screen')).toBeTruthy();
    expect(screen.queryByTestId('transactions-screen')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-manage'));
    expect(screen.getByTestId('manage-screen')).toBeTruthy();
    expect(screen.getByTestId('categories-panel')).toBeTruthy();
    expect(screen.getByTestId('budgets-panel')).toBeTruthy();
    expect(screen.getByTestId('debts-panel')).toBeTruthy();
    expect(screen.queryByTestId('overdraft-screen')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-dashboard'));
    expect(screen.getByTestId('dashboard-screen')).toBeTruthy();
  });

  it('shows the overdraft banner on every tab while the line is in use, and tapping it opens the Overdraft tab (criterion 10)', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });
    mockOverdraft(
      { limit: 2000000, monthlyRate: 1.9, plannedMonthlyPayment: 300000, createdAt: new Date(), updatedAt: new Date() },
      [
        {
          id: 'e-1',
          type: 'draw',
          amount: 1240000,
          date: new Date(2026, 3, 9),
          note: null,
          transactionId: null,
          createdAt: new Date(2026, 3, 9),
        },
      ]
    );

    await render(<App />);

    expect(screen.getByTestId('overdraft-banner')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-manage'));
    expect(screen.getByTestId('overdraft-banner')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('tab-dashboard'));
    expect(screen.getByTestId('overdraft-banner')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('overdraft-banner'));
    expect(screen.getByTestId('overdraft-screen')).toBeTruthy();
  });

  it('shows no banner while the overdraft is unused', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(screen.queryByTestId('overdraft-banner')).toBeNull();
  });
});
