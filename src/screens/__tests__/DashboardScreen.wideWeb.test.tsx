import { render, screen } from '@testing-library/react-native';

import { useBudgetsStore } from '../../budgets/store';
import { useDebtsStore } from '../../debts/store';
import { useTransactionsStore } from '../../transactions/store';
import { DashboardScreen } from '../DashboardScreen';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));
jest.mock('../../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
}));
jest.mock('../../debts/store', () => ({
  useDebtsStore: jest.fn(),
}));
jest.mock('../../theme/useWideWeb', () => ({
  useWideWeb: () => true,
}));

describe('DashboardScreen (wide web, spec 009 criterion 5)', () => {
  it('groups budgets+KPIs and donut+trend+debts into wide rows instead of one column', async () => {
    (useTransactionsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { transactions: never[] }) => unknown) => selector({ transactions: [] })
    );
    (useBudgetsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { budgets: never[] }) => unknown) => selector({ budgets: [] })
    );
    (useDebtsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { debts: never[] }) => unknown) => selector({ debts: [] })
    );

    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-wide-row-1')).toBeTruthy();
    expect(screen.getByTestId('dashboard-wide-row-2')).toBeTruthy();
  });
});
