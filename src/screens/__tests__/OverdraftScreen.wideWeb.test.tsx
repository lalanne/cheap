import { render, screen, within } from '@testing-library/react-native';

import { useOverdraftStore } from '../../overdraft/store';
import type { OverdraftEvent, OverdraftLine } from '../../overdraft/types';
import { OverdraftScreen } from '../OverdraftScreen';

jest.mock('../../overdraft/store', () => ({
  useOverdraftStore: jest.fn(),
}));
jest.mock('../../theme/useWideWeb', () => ({
  useWideWeb: () => true,
}));

const LINE: OverdraftLine = {
  limit: 2000000,
  monthlyRate: 3.45,
  plannedMonthlyPayment: 300000,
  createdAt: new Date(2026, 0, 1),
  updatedAt: new Date(2026, 0, 1),
};

function monthsAgo(months: number, day: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - months, day, 12);
}

function ev(
  id: string,
  type: OverdraftEvent['type'],
  amount: number,
  date: Date,
  offsetMs = 0,
): OverdraftEvent {
  return {
    id,
    type,
    amount,
    date,
    note: null,
    transactionId: null,
    createdAt: new Date(date.getTime() + offsetMs),
  };
}

// Same fixture shape as OverdraftScreen.test.tsx's busyEvents: balance
// 1.240.000, peak 1.600.000, so the events (oldest to newest) run
// 200.000 → 1.600.000 → 1.190.000 → 1.209.980 → 1.240.000... — kept simple
// here to make each row's "balance after" easy to hand-verify.
function orderedEvents(): OverdraftEvent[] {
  const today = new Date();
  return [
    ev('draw1', 'draw', 1600000, monthsAgo(3, 5)), // running: 1.600.000 (peak)
    ev('payment1', 'payment', 460000, monthsAgo(2, 10)), // running: 1.140.000
    ev('fee1', 'fee', 4990, monthsAgo(1, 10)), // running: 1.144.990
    ev('interest1', 'interest', 23560, today, 0), // running: 1.168.550
    ev('payment2', 'payment', 71000, today, 60000), // running: 1.097.550
  ];
}

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    line: LINE as OverdraftLine | null,
    events: orderedEvents() as OverdraftEvent[],
    setupLine: jest.fn(),
    updateLine: jest.fn(),
    logDraw: jest.fn(),
    logPayment: jest.fn(),
    logInterest: jest.fn(),
    logFee: jest.fn(),
    deleteEvent: jest.fn(),
    ...overrides,
  };
  (useOverdraftStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
  return state;
}

describe('OverdraftScreen (wide web, spec 012 addendum criterion 23)', () => {
  it('renders a fixed left rail (gauge, log actions, line terms) beside a right column (costs, road, history, activity)', async () => {
    mockStore();
    await render(<OverdraftScreen />);

    const rail = screen.getByTestId('overdraft-rail');
    expect(within(rail).getByTestId('overdraft-gauge')).toBeTruthy();
    expect(within(rail).getByTestId('log-draw-button')).toBeTruthy();
    expect(within(rail).getByTestId('log-payment-button')).toBeTruthy();
    expect(within(rail).getByTestId('log-interest-button')).toBeTruthy();
    expect(within(rail).getByTestId('log-fee-button')).toBeTruthy();
    expect(within(rail).getByTestId('overdraft-terms')).toBeTruthy();

    const column = screen.getByTestId('overdraft-wide-column');
    expect(within(column).getByTestId('overdraft-cost-month')).toBeTruthy();
    expect(within(column).getByTestId('overdraft-cost-carrying')).toBeTruthy();
    expect(within(column).getByTestId('overdraft-cost-total')).toBeTruthy();
    expect(within(column).getByTestId('overdraft-road')).toBeTruthy();
    expect(within(column).getByTestId('overdraft-history')).toBeTruthy();
    expect(within(column).getByTestId('overdraft-activity-table')).toBeTruthy();
  });

  it('still shows the setup form (not the rail/column split) with no line yet', async () => {
    mockStore({ line: null, events: [] });
    await render(<OverdraftScreen />);

    expect(screen.getByTestId('overdraft-setup-form')).toBeTruthy();
    expect(screen.queryByTestId('overdraft-rail')).toBeNull();
    expect(screen.queryByTestId('overdraft-wide-column')).toBeNull();
  });
});

describe('OverdraftScreen (wide web, spec 012 addendum criterion 24 — Balance after)', () => {
  it('shows each event newest-first with the running balance right after it', async () => {
    mockStore();
    await render(<OverdraftScreen />);

    const rows = screen.getAllByTestId(/^overdraft-activity-row-/).map((n) => n.props.testID);
    expect(rows).toEqual([
      'overdraft-activity-row-payment2',
      'overdraft-activity-row-interest1',
      'overdraft-activity-row-fee1',
      'overdraft-activity-row-payment1',
      'overdraft-activity-row-draw1',
    ]);

    expect(
      within(screen.getByTestId('overdraft-activity-row-payment2')).getByTestId('balance-after'),
    ).toHaveTextContent('$1.097.550');
    expect(
      within(screen.getByTestId('overdraft-activity-row-interest1')).getByTestId('balance-after'),
    ).toHaveTextContent('$1.168.550');
    expect(
      within(screen.getByTestId('overdraft-activity-row-fee1')).getByTestId('balance-after'),
    ).toHaveTextContent('$1.144.990');
    expect(
      within(screen.getByTestId('overdraft-activity-row-payment1')).getByTestId('balance-after'),
    ).toHaveTextContent('$1.140.000');
    expect(
      within(screen.getByTestId('overdraft-activity-row-draw1')).getByTestId('balance-after'),
    ).toHaveTextContent('$1.600.000');
  });

  it('still lets an event be deleted from the table', async () => {
    mockStore();
    await render(<OverdraftScreen />);

    await screen.getByTestId('delete-event-fee1');
  });
});
