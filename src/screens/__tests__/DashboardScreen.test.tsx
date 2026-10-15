import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { useBudgetsStore } from '../../budgets/store';
import { useDebtsStore } from '../../debts/store';
import { useCreditCardsStore } from '../../creditCards/store';
import { useOverdraftStore } from '../../overdraft/store';
import { useTransactionsStore } from '../../transactions/store';
import { DashboardScreen } from '../DashboardScreen';
import type { Budget } from '../../budgets/types';
import type { Debt } from '../../debts/types';
import type { CreditCard, CreditCardPayment } from '../../creditCards/types';
import type { OverdraftEvent, OverdraftLine } from '../../overdraft/types';
import type { Category, Transaction } from '../../transactions/types';
import { colors } from '../../theme/tokens';

function flatten(style: unknown) {
  return StyleSheet.flatten(style as never) as Record<string, unknown>;
}

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));
jest.mock('../../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
}));
jest.mock('../../debts/store', () => ({
  useDebtsStore: jest.fn(),
}));
jest.mock('../../overdraft/store', () => ({
  useOverdraftStore: jest.fn(),
}));
jest.mock('../../creditCards/store', () => ({
  useCreditCardsStore: jest.fn(),
}));

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
  overdraftLine = null,
  overdraftEvents = [],
  creditCards = [],
  creditCardPayments = [],
}: {
  transactions?: Transaction[];
  categories?: Category[];
  budgets?: Budget[];
  debts?: Debt[];
  overdraftLine?: OverdraftLine | null;
  overdraftEvents?: OverdraftEvent[];
  creditCards?: CreditCard[];
  creditCardPayments?: CreditCardPayment[];
}) {
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { transactions: Transaction[]; categories: Category[] }) => unknown) =>
      selector({ transactions, categories }),
  );
  (useBudgetsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { budgets: Budget[] }) => unknown) => selector({ budgets }),
  );
  (useDebtsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { debts: Debt[] }) => unknown) => selector({ debts }),
  );
  (useOverdraftStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { line: OverdraftLine | null; events: OverdraftEvent[] }) => unknown) =>
      selector({ line: overdraftLine, events: overdraftEvents }),
  );
  (useCreditCardsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { cards: CreditCard[]; payments: CreditCardPayment[] }) => unknown) =>
      selector({ cards: creditCards, payments: creditCardPayments }),
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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
      await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

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

  it("shows a subcategory's own spend for a budget set directly on it, and fires its overrun suggestion (criterion 9 — #34, #35)", async () => {
    mockStores({
      categories: SUBCATEGORIES,
      budgets: [
        { id: 'b-2', category: 'Groceries', monthlyLimit: 30000, createdAt: now, updatedAt: now },
      ],
      transactions: [tx({ id: 't1', category: 'Groceries', amount: 40000, date: now })],
    });
    await render(<DashboardScreen />);

    const bar = screen.getByTestId('dashboard-budget-Groceries');
    expect(within(bar).getByText(/133%/)).toBeTruthy();
    expect(screen.getByTestId('suggestion-budget-b-2')).toBeTruthy();
  });

  it('keeps the parent budget rolled up while its subcategory has its own budget (criterion 9)', async () => {
    mockStores({
      categories: SUBCATEGORIES,
      budgets: [
        { id: 'b-1', category: 'Food', monthlyLimit: 60000, createdAt: now, updatedAt: now },
        { id: 'b-2', category: 'Groceries', monthlyLimit: 50000, createdAt: now, updatedAt: now },
      ],
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 30000, date: now }),
        tx({ id: 't2', category: 'Groceries', amount: 40000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    expect(within(screen.getByTestId('dashboard-budget-Food')).getByText(/117%/)).toBeTruthy();
    expect(within(screen.getByTestId('dashboard-budget-Groceries')).getByText(/80%/)).toBeTruthy();
  });
});

describe('DashboardScreen — tap a trend bar to retarget the donut (spec 009 2026-09-25 amendment)', () => {
  it("shows the tapped month's rolled-up totals in the donut (criterion 12)", async () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);
    mockStores({
      budgets: [
        { id: 'b-1', category: 'Food', monthlyLimit: 100000, createdAt: now, updatedAt: now },
      ],
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 20000, date: now }),
        tx({ id: 't2', category: 'Housing', amount: 90000, date: twoMonthsAgo }),
      ],
    });
    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

    expect(
      within(screen.getByTestId('dashboard-donut-legend-Food')).getByText(/\$20\.000/),
    ).toBeTruthy();
    expect(within(screen.getByTestId('dashboard-budget-Food')).getByText(/20%/)).toBeTruthy();

    // last6MonthsExpense is oldest-first, index 5 = current month; two
    // months ago is index 3.
    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    expect(
      within(screen.getByTestId('dashboard-donut-legend-Housing')).getByText(/\$90\.000/),
    ).toBeTruthy();
    expect(screen.queryByTestId('dashboard-donut-legend-Food')).toBeNull();
    // Budgets/KPIs follow the month too (2026-10-10 amendment, criterion 13)
    // — covered in depth in the whole-dashboard describe block below.
  });

  it('marks the tapped bar as selected and re-targets again on a second tap', async () => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);
    mockStores({
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 20000, date: now }),
        tx({ id: 't2', category: 'Housing', amount: 90000, date: twoMonthsAgo }),
      ],
    });
    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

    const currentLabel = screen.getByTestId('dashboard-trend-bar-5-label');
    const pastLabel = screen.getByTestId('dashboard-trend-bar-3-label');
    expect(flatten(currentLabel.props.style).color).toBe(colors.accent);
    expect(flatten(pastLabel.props.style).color).not.toBe(colors.accent);

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    expect(flatten(screen.getByTestId('dashboard-trend-bar-3-label').props.style).color).toBe(
      colors.accent,
    );
    expect(flatten(screen.getByTestId('dashboard-trend-bar-5-label').props.style).color).not.toBe(
      colors.accent,
    );

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-5'));

    expect(
      within(screen.getByTestId('dashboard-donut-legend-Food')).getByText(/\$20\.000/),
    ).toBeTruthy();
  });

  it('resets an active drill-down when a different month is selected', async () => {
    const now = new Date();
    mockStores({
      categories: [{ id: 'c1', name: 'Groceries', type: 'both', parentCategory: 'Food' }],
      transactions: [
        tx({ id: 't1', category: 'Food', amount: 10000, date: now }),
        tx({ id: 't2', category: 'Groceries', amount: 5000, date: now }),
      ],
    });
    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByTestId('dashboard-view-share'));

    await fireEvent.press(screen.getByTestId('dashboard-donut-legend-Food'));
    expect(screen.getByTestId('dashboard-donut-back')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-4'));

    expect(screen.queryByTestId('dashboard-donut-back')).toBeNull();
  });
});

describe('DashboardScreen — overdraft line (spec 012 criterion 12)', () => {
  const LINE: OverdraftLine = {
    limit: 2000000,
    monthlyRate: 1.9,
    plannedMonthlyPayment: 300000,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
  };
  const drawEvent = (amount: number): OverdraftEvent => ({
    id: 'e-1',
    type: 'draw',
    amount,
    date: new Date(2026, 3, 9),
    note: null,
    transactionId: null,
    createdAt: new Date(2026, 3, 9),
  });
  const CARD: Debt = {
    id: 'd-1',
    name: 'Credit Card',
    originalAmount: 2000000,
    currentBalance: 1200000,
    minimumPayment: 100000,
    interestRate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('adds the overdraft balance to the total-debt KPI', async () => {
    mockStores({ debts: [CARD], overdraftLine: LINE, overdraftEvents: [drawEvent(1240000)] });
    await render(<DashboardScreen />);

    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$2.440.000')).toBeTruthy();
  });

  it('shows the line as a compact row in the debt section', async () => {
    mockStores({ debts: [CARD], overdraftLine: LINE, overdraftEvents: [drawEvent(1240000)] });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-overdraft-row');
    expect(within(row).getByText('Overdraft line')).toBeTruthy();
    expect(within(row).getByText(/\$1\.240\.000/)).toBeTruthy();
  });

  it('shows the balance only, with no months estimate, when the rate is unknown (amendment, criterion 19)', async () => {
    mockStores({
      overdraftLine: { ...LINE, monthlyRate: null },
      overdraftEvents: [drawEvent(1240000)],
    });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-overdraft-row');
    expect(within(row).getByText('$1.240.000')).toBeTruthy();
    expect(within(row).queryByText(/mo/)).toBeNull();
  });

  it('does not show the "No debts tracked yet" empty state when only the overdraft is in use', async () => {
    mockStores({ overdraftLine: LINE, overdraftEvents: [drawEvent(1240000)] });
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-overdraft-row')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-debts-empty')).toBeNull();
  });

  it('leaves the KPI and debt section alone when there is no line, or it is unused', async () => {
    mockStores({ debts: [CARD] });
    await render(<DashboardScreen />);
    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$1.200.000')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-overdraft-row')).toBeNull();
  });

  it('shows no row for a line at a zero balance', async () => {
    mockStores({ overdraftLine: LINE, overdraftEvents: [] });
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-overdraft-row')).toBeNull();
    expect(screen.getByTestId('dashboard-debts-empty')).toBeTruthy();
  });
});

describe('DashboardScreen — credit cards (spec 013 criterion 8)', () => {
  const VISA: CreditCard = {
    id: 'card-1',
    name: 'Visa CLP',
    limit: 2000000,
    minimumPayment: 100000,
    monthlyRate: 3.45,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("adds every card's balance to the total-debt KPI", async () => {
    mockStores({
      transactions: [tx({ id: 't1', amount: 45000, cardId: 'card-1' })],
      creditCards: [VISA],
    });
    await render(<DashboardScreen />);

    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$45.000')).toBeTruthy();
  });

  it('shows one compact row per card in the debt section', async () => {
    mockStores({
      transactions: [tx({ id: 't1', amount: 45000, cardId: 'card-1' })],
      creditCards: [VISA],
    });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-card-card-1');
    expect(within(row).getByText('Visa CLP')).toBeTruthy();
    expect(within(row).getByText(/\$45\.000/)).toBeTruthy();
  });

  it('combines with debts and the overdraft line in the same KPI total', async () => {
    mockStores({
      transactions: [tx({ id: 't1', amount: 45000, cardId: 'card-1' })],
      creditCards: [VISA],
      debts: [
        {
          id: 'd-1',
          name: 'Loan',
          originalAmount: 1000000,
          currentBalance: 500000,
          minimumPayment: 50000,
          interestRate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    await render(<DashboardScreen />);

    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$545.000')).toBeTruthy();
  });
});

describe('DashboardScreen — the month selection scopes the whole dashboard (spec 009 2026-10-10 amendment, #17)', () => {
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);
  const afterTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 1, 10);
  // Mid-year-agnostic label for the selected month, matching the screen's own.
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const pastLabel = MONTHS[twoMonthsAgo.getMonth()];
  const longAgo = new Date(now.getFullYear() - 1, 0, 1);

  const LOAN: Debt = {
    id: 'd-1',
    name: 'Loan',
    originalAmount: 1000000,
    currentBalance: 500000,
    minimumPayment: 50000,
    interestRate: null,
    createdAt: longAgo,
    updatedAt: longAgo,
  };
  const VISA: CreditCard = {
    id: 'card-1',
    name: 'Visa CLP',
    limit: 2000000,
    minimumPayment: 100000,
    monthlyRate: 3.45,
    createdAt: longAgo,
    updatedAt: longAgo,
  };
  const LINE: OverdraftLine = {
    limit: 2000000,
    monthlyRate: 1.9,
    plannedMonthlyPayment: 300000,
    createdAt: longAgo,
    updatedAt: longAgo,
  };

  function fixture() {
    mockStores({
      budgets: [
        { id: 'b-1', category: 'Food', monthlyLimit: 100000, createdAt: now, updatedAt: now },
      ],
      transactions: [
        // current month
        tx({ id: 'c1', category: 'Food', amount: 20000, date: now }),
        // the selected (two months ago) month
        tx({ id: 'p1', category: 'Food', amount: 50000, date: twoMonthsAgo }),
        tx({ id: 'p2', type: 'income', category: 'Salary', amount: 300000, date: twoMonthsAgo }),
        tx({ id: 'p3', category: 'Misc', amount: 25000, date: twoMonthsAgo, cardId: 'card-1' }),
        // a Loan payment made AFTER the selected month -> added back
        tx({ id: 'p4', category: 'Loan', amount: 40000, date: afterTwoMonthsAgo }),
      ],
      debts: [LOAN],
      creditCards: [VISA],
      overdraftLine: LINE,
      overdraftEvents: [
        {
          id: 'e1',
          type: 'draw',
          amount: 200000,
          date: twoMonthsAgo,
          note: null,
          transactionId: null,
          createdAt: twoMonthsAgo,
        },
        {
          id: 'e2',
          type: 'payment',
          amount: 50000,
          date: now,
          note: null,
          transactionId: null,
          createdAt: now,
        },
      ],
    });
  }

  it('re-scopes spent/saved KPIs and budgets to the selected month, labelled with it (criterion 13)', async () => {
    fixture();
    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    // 50.000 Food + 25.000 Misc spent; 300.000 income -> 225.000 saved.
    expect(within(screen.getByTestId('dashboard-kpi-spent')).getByText(/\$75\.000/)).toBeTruthy();
    expect(within(screen.getByTestId('dashboard-kpi-saved')).getByText(/\$225\.000/)).toBeTruthy();
    expect(within(screen.getByTestId('dashboard-budget-Food')).getByText(/50%/)).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-kpi-spent')).getByText(new RegExp(pastLabel)),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-budgets')).getByText(`Budgets — ${pastLabel}`),
    ).toBeTruthy();
  });

  it('shows month-end debt balances in the KPI and rows, labelled with the month (criterion 14)', async () => {
    fixture();
    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    // Loan 500.000 + 40.000 paid later = 540.000; Visa 25.000; overdraft 200.000.
    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$765.000')).toBeTruthy();
    expect(within(screen.getByTestId('dashboard-card-card-1')).getByText(/\$25\.000/)).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-overdraft-row')).getByText(/\$200\.000/),
    ).toBeTruthy();
    // 46% paid = (1.000.000 - 540.000) / 1.000.000
    expect(within(screen.getByTestId('dashboard-debt-d-1')).getByText(/46% paid/)).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-debts')).getByText(new RegExp(pastLabel)),
    ).toBeTruthy();
  });

  it('returns every section to current-month data when the current bar is tapped (criterion 15)', async () => {
    fixture();
    await render(<DashboardScreen />);
    const spentBefore = within(screen.getByTestId('dashboard-kpi-spent')).getByText(/\$20\.000/);
    expect(spentBefore).toBeTruthy();
    const debtBefore = within(screen.getByTestId('dashboard-kpi-debt')).queryByText('$765.000');
    expect(debtBefore).toBeNull();

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));
    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-5'));

    expect(within(screen.getByTestId('dashboard-kpi-spent')).getByText(/\$20\.000/)).toBeTruthy();
    // Loan 500.000 + Visa 25.000 (tagged expense) + overdraft 150.000.
    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$675.000')).toBeTruthy();
  });

  it('shows month-named empty states when nothing existed yet (criterion 16)', async () => {
    mockStores({
      transactions: [tx({ id: 'c1', category: 'Food', amount: 20000, date: now })],
      debts: [{ ...LOAN, createdAt: now }],
      creditCards: [VISA],
      overdraftLine: LINE,
      overdraftEvents: [
        {
          id: 'e2',
          type: 'draw',
          amount: 50000,
          date: now,
          note: null,
          transactionId: null,
          createdAt: now,
        },
      ],
    });
    await render(<DashboardScreen />);
    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    expect(screen.getByTestId('dashboard-debts-empty')).toHaveTextContent(
      `No debts recorded as of ${pastLabel}.`,
    );
    expect(screen.queryByTestId('dashboard-debt-d-1')).toBeNull();
    expect(screen.queryByTestId('dashboard-card-card-1')).toBeNull();
    expect(screen.queryByTestId('dashboard-overdraft-row')).toBeNull();
    expect(within(screen.getByTestId('dashboard-kpi-debt')).getByText('$0')).toBeTruthy();
  });

  it('leaves the suggestions feed on the current month (criterion 17)', async () => {
    const overBudget = [
      tx({ id: 'c1', category: 'Entertainment', amount: 95000, date: now }),
      tx({ id: 'p1', category: 'Entertainment', amount: 1000, date: twoMonthsAgo }),
    ];
    mockStores({
      transactions: overBudget,
      budgets: [
        {
          id: 'b-1',
          category: 'Entertainment',
          monthlyLimit: 60000,
          createdAt: now,
          updatedAt: now,
        },
      ],
      debts: [LOAN],
    });
    await render(<DashboardScreen />);
    expect(screen.getByTestId('suggestion-budget-b-1')).toBeTruthy();
    expect(screen.getByTestId('suggestion-debt-d-1')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    expect(screen.getByTestId('suggestion-budget-b-1')).toBeTruthy();
    expect(screen.getByTestId('suggestion-debt-d-1')).toBeTruthy();
    // ...while the budget bar itself now shows the selected month (2%).
    expect(
      within(screen.getByTestId('dashboard-budget-Entertainment')).getByText(/2%/),
    ).toBeTruthy();
  });
});

describe('DashboardScreen — total budgeted vs. income (spec 009 2026-10-11 amendment, #15)', () => {
  const now = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 15);
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const budgets: Budget[] = [
    { id: 'b-1', category: 'Rent', monthlyLimit: 900000, createdAt: now, updatedAt: now },
    { id: 'b-2', category: 'Food', monthlyLimit: 450000, createdAt: now, updatedAt: now },
  ];

  it('shows total budgeted, income and the percentage, with a proportional bar (criterion 18)', async () => {
    mockStores({
      budgets,
      transactions: [
        tx({ id: 'i1', type: 'income', category: 'Salary', amount: 1800000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-budgeted-vs-income');
    expect(within(row).getByText(/75% of income/)).toBeTruthy();
    expect(within(row).getByText(/\$1\.350\.000 budgeted/)).toBeTruthy();
    expect(within(row).getByText(/\$1\.800\.000 income/)).toBeTruthy();
    const fill = flatten(screen.getByTestId('dashboard-budgeted-bar').props.style);
    expect(fill.width).toBe('75%');
    expect(fill.backgroundColor).toBe(colors.accent);
  });

  it('shows the real percentage over 100% with a full bar in the over color (criterion 19)', async () => {
    mockStores({
      budgets,
      transactions: [
        tx({ id: 'i1', type: 'income', category: 'Salary', amount: 1000000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-budgeted-vs-income');
    expect(within(row).getByText(/135% of income/)).toBeTruthy();
    const fill = flatten(screen.getByTestId('dashboard-budgeted-bar').props.style);
    expect(fill.width).toBe('100%');
    expect(fill.backgroundColor).toBe(colors.chart[1]);
  });

  it('says there is no income and shows no percentage or bar when income is zero (criterion 20)', async () => {
    mockStores({ budgets, transactions: [] });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-budgeted-vs-income');
    expect(
      within(row).getByText(new RegExp(`No income recorded in ${MONTHS[now.getMonth()]}`)),
    ).toBeTruthy();
    expect(within(row).getByText(/\$1\.350\.000/)).toBeTruthy();
    expect(within(row).queryByText(/%/)).toBeNull();
    expect(screen.queryByTestId('dashboard-budgeted-bar')).toBeNull();
  });

  it('is absent with no budgets, leaving the existing empty state (criterion 21)', async () => {
    mockStores({
      budgets: [],
      transactions: [
        tx({ id: 'i1', type: 'income', category: 'Salary', amount: 1800000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-budgeted-vs-income')).toBeNull();
    expect(screen.getByTestId('dashboard-budgets-empty')).toBeTruthy();
  });

  it("uses the selected month's income and names the month (criterion 22)", async () => {
    mockStores({
      budgets,
      transactions: [
        tx({ id: 'i-now', type: 'income', category: 'Salary', amount: 1800000, date: now }),
        tx({
          id: 'i-past',
          type: 'income',
          category: 'Salary',
          amount: 2700000,
          date: twoMonthsAgo,
        }),
      ],
    });
    await render(<DashboardScreen />);
    expect(
      within(screen.getByTestId('dashboard-budgeted-vs-income')).getByText(/75% of income/),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-3'));

    const row = screen.getByTestId('dashboard-budgeted-vs-income');
    expect(within(row).getByText(/50% of income/)).toBeTruthy();
    expect(within(row).getByText(new RegExp(MONTHS[twoMonthsAgo.getMonth()]))).toBeTruthy();
  });

  it('does not double-count a subcategory budget under a budgeted parent (criterion 23)', async () => {
    mockStores({
      budgets: [
        { id: 'b-1', category: 'Food', monthlyLimit: 400000, createdAt: now, updatedAt: now },
        {
          id: 'b-2',
          category: 'Restaurants',
          monthlyLimit: 100000,
          createdAt: now,
          updatedAt: now,
        },
      ],
      categories: [{ id: 'c-1', name: 'Restaurants', type: 'expense', parentCategory: 'Food' }],
      transactions: [
        tx({ id: 'i1', type: 'income', category: 'Salary', amount: 1000000, date: now }),
      ],
    });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-budgeted-vs-income');
    expect(within(row).getByText(/\$400\.000 budgeted/)).toBeTruthy();
    expect(within(row).getByText(/40% of income/)).toBeTruthy();
  });
});

describe('DashboardScreen — budget bar (spec 009 2026-10-15 amendment, #36, option C)', () => {
  const now = new Date();
  const lastMonthMid = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  function budget(category: string, monthlyLimit: number): Budget {
    return { id: `b-${category}`, category, monthlyLimit, createdAt: now, updatedAt: now };
  }

  it('renders one block per budget, sized by limit share, filled by usage (criteria 24, 25)', async () => {
    mockStores({
      transactions: [tx({ id: 't1', category: 'Rent', amount: 150, date: now })],
      budgets: [budget('Rent', 300), budget('Fun', 100)],
    });
    await render(<DashboardScreen />);

    expect(flatten(screen.getByTestId('dashboard-budgetbar-block-Rent').props.style).width).toBe(
      '75%',
    );
    expect(flatten(screen.getByTestId('dashboard-budgetbar-block-Fun').props.style).width).toBe(
      '25%',
    );
    expect(flatten(screen.getByTestId('dashboard-budgetbar-fill-Rent').props.style).width).toBe(
      '50%',
    );
    expect(
      within(screen.getByTestId('dashboard-budgetbar-summary')).getByText(
        'Spent $150 of $400 budget',
      ),
    ).toBeTruthy();
  });

  it('shows real spent / limit, the over color and a Needs attention callout when over (criterion 26)', async () => {
    mockStores({
      transactions: [tx({ id: 't1', category: 'Fun', amount: 205, date: now })],
      budgets: [budget('Fun', 200)],
    });
    await render(<DashboardScreen />);

    const row = screen.getByTestId('dashboard-budgetbar-row-Fun');
    const text = within(row).getByText('$205 / $200');
    expect(flatten(text.props.style).color).toBe(colors.chart[1]);
    const fill = flatten(screen.getByTestId('dashboard-budgetbar-fill-Fun').props.style);
    expect(fill.width).toBe('100%');
    expect(fill.backgroundColor).toBe(colors.chart[1]);
    expect(
      within(screen.getByTestId('dashboard-budgetbar-summary')).getByText(
        'Spent $205 of $200 budget',
      ),
    ).toBeTruthy();
    const callout = screen.getByTestId('dashboard-budgetbar-attention');
    expect(within(callout).getByText('Needs attention')).toBeTruthy();
    expect(within(callout).getByText('Fun +$5')).toBeTruthy();
  });

  it('has no Needs attention callout when nothing is over (criterion 26)', async () => {
    mockStores({
      transactions: [tx({ id: 't1', category: 'Fun', amount: 50, date: now })],
      budgets: [budget('Fun', 200)],
    });
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-budgetbar-attention')).toBeNull();
  });

  it('keeps unbudgeted spend out of the bar and summary, listing it in an Unbudgeted row (criterion 27)', async () => {
    mockStores({
      transactions: [
        tx({ id: 't1', category: 'Rent', amount: 100, date: now }),
        tx({ id: 't2', category: 'Misc', amount: 40, date: now }),
      ],
      budgets: [budget('Rent', 300)],
    });
    await render(<DashboardScreen />);

    expect(screen.queryByTestId('dashboard-budgetbar-block-Misc')).toBeNull();
    expect(
      within(screen.getByTestId('dashboard-budgetbar-summary')).getByText(
        'Spent $100 of $300 budget',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-budgetbar-unbudgeted')).getByText('$40'),
    ).toBeTruthy();
  });

  it('lists the 5 most-used rows with Show more / Show less (criterion 28)', async () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    mockStores({
      transactions: names.map((n, i) =>
        tx({ id: `t${i}`, category: n, amount: (i + 1) * 10, date: now }),
      ),
      budgets: names.map((n) => budget(n, 100)),
    });
    await render(<DashboardScreen />);

    // usage rises A -> G, so G..C are shown first
    expect(screen.getByTestId('dashboard-budgetbar-row-G')).toBeTruthy();
    expect(screen.getByTestId('dashboard-budgetbar-row-C')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-budgetbar-row-B')).toBeNull();

    await fireEvent.press(screen.getByTestId('dashboard-budgetbar-more'));
    expect(screen.getByTestId('dashboard-budgetbar-row-A')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('dashboard-budgetbar-more'));
    expect(screen.queryByTestId('dashboard-budgetbar-row-A')).toBeNull();
  });

  it('shows the empty state and no bar without budgets (criterion 29)', async () => {
    mockStores({});
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-budgetbar-empty')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-budgetbar-summary')).toBeNull();
  });

  it("follows the selected month against today's limits and names it in the title (criterion 30)", async () => {
    mockStores({
      transactions: [
        tx({ id: 't1', category: 'Rent', amount: 100, date: now }),
        tx({ id: 't2', category: 'Rent', amount: 250, date: lastMonthMid }),
      ],
      budgets: [budget('Rent', 300)],
    });
    await render(<DashboardScreen />);

    await fireEvent.press(screen.getByTestId('dashboard-trend-bar-4'));
    expect(
      within(screen.getByTestId('dashboard-budgetbar-summary')).getByText(
        'Spent $250 of $300 budget',
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('dashboard-budgetbar')).getByText(/Budget used — /),
    ).toBeTruthy();
  });

  it('web hover shows the category and spent / limit above the bar; none on native (criterion 31)', async () => {
    const originalOS = Platform.OS;
    mockStores({
      transactions: [tx({ id: 't1', category: 'Rent', amount: 100, date: now })],
      budgets: [budget('Rent', 300)],
    });
    Platform.OS = 'web';
    try {
      await render(<DashboardScreen />);
      expect(screen.queryByTestId('dashboard-budgetbar-hover-label')).toBeNull();
      await fireEvent(screen.getByTestId('dashboard-budgetbar-block-Rent'), 'hoverIn');
      const label = screen.getByTestId('dashboard-budgetbar-hover-label');
      expect(within(label).getByText('Rent')).toBeTruthy();
      expect(within(label).getByText('$100 / $300')).toBeTruthy();
      await fireEvent(screen.getByTestId('dashboard-budgetbar-block-Rent'), 'hoverOut');
      expect(screen.queryByTestId('dashboard-budgetbar-hover-label')).toBeNull();
    } finally {
      Platform.OS = originalOS;
    }
    // native default: no handler attached
    await screen.unmount();
    await render(<DashboardScreen />);
    await fireEvent(screen.getByTestId('dashboard-budgetbar-block-Rent'), 'hoverIn');
    expect(screen.queryByTestId('dashboard-budgetbar-hover-label')).toBeNull();
  });

  it('defaults to the budget bar and toggles to the donut and back (criterion 32)', async () => {
    mockStores({
      transactions: [tx({ id: 't1', category: 'Rent', amount: 100, date: now })],
      budgets: [budget('Rent', 300)],
    });
    await render(<DashboardScreen />);

    expect(screen.getByTestId('dashboard-budgetbar')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-donut-arc-Rent')).toBeNull();

    await fireEvent.press(screen.getByTestId('dashboard-view-share'));
    expect(screen.getByTestId('dashboard-donut-arc-Rent')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-budgetbar')).toBeNull();

    await fireEvent.press(screen.getByTestId('dashboard-view-budget'));
    expect(screen.getByTestId('dashboard-budgetbar')).toBeTruthy();
  });
});
