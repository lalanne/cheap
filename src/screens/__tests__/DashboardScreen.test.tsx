import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { useBudgetsStore } from '../../budgets/store';
import { useDebtsStore } from '../../debts/store';
import { useTransactionsStore } from '../../transactions/store';
import { DashboardScreen } from '../DashboardScreen';
import type { Budget } from '../../budgets/types';
import type { Debt } from '../../debts/types';
import type { Category, Transaction } from '../../transactions/types';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));
jest.mock('../../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
}));
jest.mock('../../debts/store', () => ({
  useDebtsStore: jest.fn(),
}));

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 10000,
    category: 'Food',
    date: new Date(),
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockStores({
  transactions = [],
  categories = [],
  budgets = [],
  debts = [],
}: {
  transactions?: Transaction[];
  categories?: Category[];
  budgets?: Budget[];
  debts?: Debt[];
}) {
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { transactions: Transaction[]; categories: Category[] }) => unknown) =>
      selector({ transactions, categories })
  );
  (useBudgetsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { budgets: Budget[] }) => unknown) => selector({ budgets })
  );
  (useDebtsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { debts: Debt[] }) => unknown) => selector({ debts })
  );
}

describe('DashboardScreen (narrow/native — useWideWeb false by default under test)', () => {
  it('renders empty states when there is no data (criterion 6)', async () => {
    mockStores({});
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-budgets-empty')).toBeTruthy();
    expect(screen.getByTestId('dashboard-debts-empty')).toBeTruthy();
  });

  it('flags an over-budget category in the suggestions feed and its progress bar (criterion 2)', async () => {
    const now = new Date();
    mockStores({
      transactions: [tx({ category: 'Entertainment', amount: 95000, date: now })],
      budgets: [
        {
          id: 'b-1',
          category: 'Entertainment',
          monthlyLimit: 60000,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    await render(<DashboardScreen />);

    expect(screen.getByTestId('suggestion-budget-b-1')).toBeTruthy();
    const bar = screen.getByTestId('dashboard-budget-Entertainment');
    expect(within(bar).getByText(/158%/)).toBeTruthy();
  });

  it('shows a debt-pace suggestion with both estimates (criterion 3)', async () => {
    const now = new Date();
    mockStores({
      debts: [
        {
          id: 'd-1',
          name: 'Credit Card',
          originalAmount: 2000000,
          currentBalance: 1400000,
          minimumPayment: 100000,
          interestRate: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    await render(<DashboardScreen />);

    const suggestion = screen.getByTestId('suggestion-debt-d-1');
    expect(within(suggestion).getByText(/14 months/)).toBeTruthy();
    expect(within(suggestion).getByText(/7 months/)).toBeTruthy();
  });

  it('stacks sections in a single column (no wide-row wrappers) when useWideWeb is false', async () => {
    mockStores({});
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-wide-row-1')).toBeNull();
    expect(screen.queryByTestId('dashboard-wide-row-2')).toBeNull();
    expect(screen.getByTestId('dashboard-budgets')).toBeTruthy();
    expect(screen.getByTestId('dashboard-donut')).toBeTruthy();
    expect(screen.getByTestId('dashboard-trend')).toBeTruthy();
    expect(screen.getByTestId('dashboard-debts')).toBeTruthy();
  });

  it('draws each donut segment as an arc proportional to its spend, not a full circle for every segment (criterion 7 regression)', async () => {
    const now = new Date();
    mockStores({
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 300, date: now }),
        tx({ id: 't2', category: 'Transport', amount: 100, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    const DONUT_RADIUS = 60;
    const circumference = 2 * Math.PI * DONUT_RADIUS;
    const foodDashLength = (300 / 400) * circumference;
    const transportDashLength = (100 / 400) * circumference;

    // Bug (real, seen live): strokeDasharray was hardcoded to the full
    // circumference for every segment, so every circle drew as a
    // complete ring and only the last one or two painted on top were
    // visible at all — the proportions never showed up.
    // react-native-svg normalizes the "<dash> <gap>" string into an
    // array of numeric strings before it reaches props.
    expect(screen.getByTestId('dashboard-donut-arc-Food').props.strokeDasharray).toEqual([
      `${foodDashLength}`,
      `${circumference}`,
    ]);
    expect(screen.getByTestId('dashboard-donut-arc-Transport').props.strokeDasharray).toEqual([
      `${transportDashLength}`,
      `${circumference}`,
    ]);
  });

  it('does not attach a hover handler on native — no hover label ever appears (criterion 11)', async () => {
    const now = new Date();
    mockStores({
      transactions: [tx({ id: 't1', category: 'Food', amount: 300, date: now })],
    });
    await render(<DashboardScreen />);

    await fireEvent(screen.getByTestId('dashboard-donut-arc-Food'), 'mouseEnter');

    expect(screen.queryByTestId('dashboard-donut-hover-label')).toBeNull();
  });
});

describe('DashboardScreen (web) — donut hover-to-reveal (spec 009 criterion 11)', () => {
  it('shows the hovered category and its spend in the donut center, and clears on mouse leave', async () => {
    const now = new Date();
    const originalOS = Platform.OS;
    Platform.OS = 'web';
    try {
      mockStores({
        transactions: [
          tx({ id: 't1', category: 'Food', amount: 300, date: now }),
          tx({ id: 't2', category: 'Transport', amount: 100, date: now }),
        ],
      });
      await render(<DashboardScreen />);

      expect(screen.queryByTestId('dashboard-donut-hover-label')).toBeNull();

      await fireEvent(screen.getByTestId('dashboard-donut-arc-Food'), 'mouseEnter');
      const label = screen.getByTestId('dashboard-donut-hover-label');
      expect(within(label).getByText('Food')).toBeTruthy();
      expect(within(label).getByText('$300')).toBeTruthy();

      await fireEvent(screen.getByTestId('dashboard-donut-arc-Food'), 'mouseLeave');
      expect(screen.queryByTestId('dashboard-donut-hover-label')).toBeNull();
    } finally {
      Platform.OS = originalOS;
    }
  });
});

describe('DashboardScreen — subcategory drill-down (spec 011)', () => {
  const now = new Date();
  const SUBCATEGORIES: Category[] = [
    { id: 'c1', name: 'Groceries', type: 'both', parentCategory: 'Food' },
    { id: 'c2', name: 'Uber Eats', type: 'both', parentCategory: 'Food' },
  ];

  it('rolls subcategory spend into the parent slice, not as its own top-level slice (criterion 3)', async () => {
    mockStores({
      categories: SUBCATEGORIES,
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 100000, date: now }),
        tx({ id: 't2', category: 'Groceries', amount: 220000, date: now }),
        tx({ id: 't3', category: 'Uber Eats', amount: 130000, date: now }),
        tx({ id: 't4', category: 'Housing', amount: 350000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    const foodRow = screen.getByTestId('dashboard-donut-legend-Food');
    expect(within(foodRow).getByText(/\$450\.000/)).toBeTruthy();
    expect(screen.queryByTestId('dashboard-donut-legend-Groceries')).toBeNull();
    expect(screen.queryByTestId('dashboard-donut-legend-Uber Eats')).toBeNull();
  });

  it('drills into a category with subcategories on tap, and back again (criterion 4)', async () => {
    mockStores({
      categories: SUBCATEGORIES,
      transactions: [
        tx({ id: 't1', category: 'Groceries', amount: 220000, date: now }),
        tx({ id: 't2', category: 'Uber Eats', amount: 130000, date: now }),
        tx({ id: 't3', category: 'Housing', amount: 350000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-donut-back')).toBeNull();

    await fireEvent.press(screen.getByTestId('dashboard-donut-legend-Food'));

    expect(screen.getByTestId('dashboard-donut-back')).toBeTruthy();
    expect(screen.getByTestId('dashboard-donut-legend-Groceries')).toBeTruthy();
    expect(screen.getByTestId('dashboard-donut-legend-Uber Eats')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-donut-legend-Housing')).toBeNull();

    await fireEvent.press(screen.getByTestId('dashboard-donut-back'));

    expect(screen.queryByTestId('dashboard-donut-back')).toBeNull();
    expect(screen.getByTestId('dashboard-donut-legend-Food')).toBeTruthy();
    expect(screen.getByTestId('dashboard-donut-legend-Housing')).toBeTruthy();
  });

  it('does nothing when tapping a category with no subcategories (criterion 5)', async () => {
    mockStores({
      categories: SUBCATEGORIES,
      transactions: [
        tx({ id: 't1', category: 'Groceries', amount: 220000, date: now }),
        tx({ id: 't2', category: 'Housing', amount: 350000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByTestId('dashboard-donut-legend-Housing'));

    expect(screen.queryByTestId('dashboard-donut-back')).toBeNull();
    expect(screen.getByTestId('dashboard-donut-legend-Food')).toBeTruthy();
  });

  it('shows an orphaned subcategory as its own top-level slice when its parent no longer exists (criterion 6)', async () => {
    mockStores({
      categories: [{ id: 'c9', name: 'Old Sub', type: 'both', parentCategory: 'Deleted Parent' }],
      transactions: [tx({ id: 't1', category: 'Old Sub', amount: 75000, date: now })],
    });
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-donut-legend-Old Sub')).toBeTruthy();
  });

  it('uses rolled-up spend (direct + subcategories) for the budget bar and its overrun suggestion (criterion 8 — 2026-09-25 amendment)', async () => {
    mockStores({
      categories: SUBCATEGORIES,
      budgets: [
        {
          id: 'b-1',
          category: 'Food',
          monthlyLimit: 60000,
          createdAt: now,
          updatedAt: now,
        },
      ],
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 30000, date: now }),
        tx({ id: 't2', category: 'Groceries', amount: 40000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    const bar = screen.getByTestId('dashboard-budget-Food');
    expect(within(bar).getByText(/117%/)).toBeTruthy();
    expect(screen.getByTestId('suggestion-budget-b-1')).toBeTruthy();
  });
});
