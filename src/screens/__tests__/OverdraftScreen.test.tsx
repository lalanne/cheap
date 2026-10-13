import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useOverdraftStore } from '../../overdraft/store';
import type { OverdraftEvent, OverdraftEventType, OverdraftLine } from '../../overdraft/types';
import { colors } from '../../theme/tokens';
import { OverdraftScreen } from '../OverdraftScreen';

jest.mock('../../overdraft/store', () => ({
  useOverdraftStore: jest.fn(),
}));

const LINE: OverdraftLine = {
  limit: 2000000,
  monthlyRate: 1.9,
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
  type: OverdraftEventType,
  amount: number,
  date: Date,
  createdAtOffsetMs = 0,
): OverdraftEvent {
  return {
    id,
    type,
    amount,
    date,
    note: null,
    transactionId: null,
    createdAt: new Date(date.getTime() + createdAtOffsetMs),
  };
}

// Balance 1.240.000 of a 2.000.000 line (62%); peak 1.600.000 (22% cleared);
// this month: interest 23.560 + fees 4.990; all-time cost 48.550.
function busyEvents(): OverdraftEvent[] {
  const today = new Date();
  return [
    ev('draw', 'draw', 1600000, monthsAgo(3, 5)),
    ev('payment', 'payment', 408550, monthsAgo(2, 10)),
    ev('oldInterest', 'interest', 20000, monthsAgo(1, 10)),
    ev('interest', 'interest', 23560, today, 0),
    ev('fee', 'fee', 4990, today, 60000),
  ];
}

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    line: LINE as OverdraftLine | null,
    events: [] as OverdraftEvent[],
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

function flat(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;
}

describe('OverdraftScreen — first-run setup (spec 012 criterion 1)', () => {
  it('shows only the setup form when no line exists yet', async () => {
    mockStore({ line: null });
    await render(<OverdraftScreen />);

    expect(screen.getByTestId('overdraft-screen')).toBeTruthy();
    expect(screen.getByTestId('overdraft-setup-form')).toBeTruthy();
    expect(screen.queryByTestId('overdraft-gauge')).toBeNull();
  });

  it('sets the line up with limit, monthly rate, planned payment and opening balance', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.changeText(screen.getByTestId('setup-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('setup-rate-input'), '1.9');
    await fireEvent.changeText(screen.getByTestId('setup-planned-payment-input'), '300000');
    await fireEvent.changeText(screen.getByTestId('setup-opening-balance-input'), '1240000');
    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).toHaveBeenCalledWith({
      limit: 2000000,
      monthlyRate: 1.9,
      plannedMonthlyPayment: 300000,
      openingBalance: 1240000,
    });
  });

  it('treats planned payment and opening balance as optional', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.changeText(screen.getByTestId('setup-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('setup-rate-input'), '1.9');
    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).toHaveBeenCalledWith({
      limit: 2000000,
      monthlyRate: 1.9,
      plannedMonthlyPayment: null,
      openingBalance: null,
    });
  });

  it('rejects a limit that is not a whole positive peso amount', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.changeText(screen.getByTestId('setup-limit-input'), 'abc');
    await fireEvent.changeText(screen.getByTestId('setup-rate-input'), '1.9');
    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).not.toHaveBeenCalled();
    expect(
      screen.getByText('Enter a whole number in pesos — no decimals or symbols.'),
    ).toBeTruthy();
  });

  it('labels the rate field as optional and says it can be added later (addendum, criterion 21)', async () => {
    mockStore({ line: null });
    await render(<OverdraftScreen />);

    const form = screen.getByTestId('overdraft-setup-form');
    expect(within(form).getByText('Monthly rate, % (optional)')).toBeTruthy();
    expect(within(form).getByText(/leave the rate blank/i)).toBeTruthy();
  });

  it('saves the line without a rate when the rate is left blank (amendment, criterion 16)', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.changeText(screen.getByTestId('setup-limit-input'), '2000000');
    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).toHaveBeenCalledWith({
      limit: 2000000,
      monthlyRate: null,
      plannedMonthlyPayment: null,
      openingBalance: null,
    });
  });

  it('saves a real 0% rate as 0, not as unknown (amendment, criterion 16)', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.changeText(screen.getByTestId('setup-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('setup-rate-input'), '0');
    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).toHaveBeenCalledWith(expect.objectContaining({ monthlyRate: 0 }));
  });

  it('still requires the limit even though the rate is optional', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).not.toHaveBeenCalled();
    expect(screen.getByText('Enter an amount.')).toBeTruthy();
  });

  it('rejects a non-numeric monthly rate', async () => {
    const store = mockStore({ line: null });
    await render(<OverdraftScreen />);

    await fireEvent.changeText(screen.getByTestId('setup-limit-input'), '2000000');
    await fireEvent.changeText(screen.getByTestId('setup-rate-input'), 'abc');
    await fireEvent.press(screen.getByTestId('save-overdraft-line-button'));

    expect(store.setupLine).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a monthly rate, like 1.9.')).toBeTruthy();
  });
});

describe('OverdraftScreen — the visual sections (criterion 11)', () => {
  it('renders the usage gauge with the used amount, percent, availability and the in-use status color', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    const gauge = screen.getByTestId('overdraft-gauge');
    expect(within(gauge).getByText('$1.240.000')).toBeTruthy();
    expect(within(gauge).getByText('of $2.000.000 limit')).toBeTruthy();
    expect(within(gauge).getByText('62% used')).toBeTruthy();
    expect(within(gauge).getByText('$760.000 available')).toBeTruthy();
    expect(within(screen.getByTestId('overdraft-status')).getByText('In use')).toBeTruthy();
    expect(flat('overdraft-gauge-fill').width).toBe('62%');
    expect(flat('overdraft-gauge-fill').backgroundColor).toBe(colors.status.notice.text);
    expect(screen.getByTestId('overdraft-gauge-threshold')).toBeTruthy();
  });

  it('turns the gauge critical and caps the fill at the track when over the limit', async () => {
    mockStore({ events: [ev('d', 'draw', 2120000, monthsAgo(1, 3))] });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('overdraft-status')).getByText('Over limit')).toBeTruthy();
    expect(flat('overdraft-gauge-fill').width).toBe('100%');
    expect(flat('overdraft-gauge-fill').backgroundColor).toBe(colors.status.critical.text);
    expect(within(screen.getByTestId('overdraft-gauge')).getByText('106% used')).toBeTruthy();
  });

  it('shows the warning color from 75%', async () => {
    mockStore({ events: [ev('d', 'draw', 1560000, monthsAgo(1, 3))] });
    await render(<OverdraftScreen />);

    expect(flat('overdraft-gauge-fill').backgroundColor).toBe(colors.status.warning.text);
  });

  it('renders the three cost cards from logged events and the current balance', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    const month = screen.getByTestId('overdraft-cost-month');
    expect(within(month).getByText('$28.550')).toBeTruthy();
    expect(within(month).getByText('Interest $23.560')).toBeTruthy();
    expect(within(month).getByText('Fees $4.990')).toBeTruthy();
    expect(
      within(screen.getByTestId('overdraft-cost-carrying')).getByText('$23.560 / mo'),
    ).toBeTruthy();
    expect(within(screen.getByTestId('overdraft-cost-total')).getByText('$48.550')).toBeTruthy();
  });

  it('renders the road to zero: amount owed, percent cleared from the peak, planned payment and payoff sentence', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    const road = screen.getByTestId('overdraft-road');
    expect(within(road).getByText('$1.240.000')).toBeTruthy();
    expect(within(road).getByText('22% cleared from the $1.600.000 peak')).toBeTruthy();
    expect(within(road).getByText('$300.000 / month')).toBeTruthy();
    expect(
      within(road).getByText('Clears in about 5 months, paying ≈ $63.630 more in interest.'),
    ).toBeTruthy();
    expect(flat('overdraft-cleared-fill').width).toBe('22%');
  });

  it('warns when the planned payment does not cover the interest', async () => {
    mockStore({ line: { ...LINE, plannedMonthlyPayment: 20000 }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(
      within(screen.getByTestId('overdraft-road')).getByText(/doesn.t cover the interest/),
    ).toBeTruthy();
  });

  it('prompts for a planned payment when none is set, and the prompt opens the settings form (criterion 15)', async () => {
    mockStore({ line: { ...LINE, plannedMonthlyPayment: null }, events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('set-planned-payment-button'));

    expect(screen.getByTestId('overdraft-settings-form')).toBeTruthy();
  });

  it('says so when the balance is back at zero', async () => {
    mockStore({
      events: [
        ev('d', 'draw', 100000, monthsAgo(2, 3)),
        ev('p', 'payment', 100000, monthsAgo(1, 3)),
      ],
    });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('overdraft-road')).getByText(/back to zero/i)).toBeTruthy();
    expect(within(screen.getByTestId('overdraft-status')).getByText('Not in use')).toBeTruthy();
  });

  it('renders the six-month balance history', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(screen.getByTestId('overdraft-history')).toBeTruthy();
  });

  it('lists events newest first, with a sign showing whether each one raises or lowers what is owed', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    const ids = screen.getAllByTestId(/^overdraft-event-/).map((n) => n.props.testID);
    expect(ids).toEqual([
      'overdraft-event-fee',
      'overdraft-event-interest',
      'overdraft-event-oldInterest',
      'overdraft-event-payment',
      'overdraft-event-draw',
    ]);
    expect(
      within(screen.getByTestId('overdraft-event-draw')).getByText('+$1.600.000'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('overdraft-event-payment')).getByText('−$408.550'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('overdraft-event-interest')).getByText('+$23.560'),
    ).toBeTruthy();
  });

  it('deletes an event through the store', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('delete-event-fee'));

    expect(store.deleteEvent).toHaveBeenCalledWith('fee');
  });

  it('shows an explanatory empty state, not a blank section, with a line but no events', async () => {
    mockStore({ events: [] });
    await render(<OverdraftScreen />);

    expect(screen.getByTestId('overdraft-empty')).toBeTruthy();
    expect(within(screen.getByTestId('overdraft-status')).getByText('Not in use')).toBeTruthy();
    expect(within(screen.getByTestId('overdraft-gauge')).getByText('0% used')).toBeTruthy();
  });
});

describe('OverdraftScreen — unknown rate (amendment, criteria 17–19)', () => {
  const UNKNOWN_RATE = { ...LINE, monthlyRate: null };

  it('shows an "add your rate" prompt instead of $0 / mo on the carrying-cost card, and it opens settings (criterion 17)', async () => {
    mockStore({ line: UNKNOWN_RATE, events: busyEvents() });
    await render(<OverdraftScreen />);

    const card = screen.getByTestId('overdraft-cost-carrying');
    expect(within(card).queryByText(/\/ mo/)).toBeNull();
    expect(within(card).getByText('Add your rate to see this')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('carrying-add-rate-button'));
    expect(screen.getByTestId('overdraft-settings-form')).toBeTruthy();
  });

  it('leaves the charged-this-month and total-paid cards unchanged (criterion 17)', async () => {
    mockStore({ line: UNKNOWN_RATE, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('overdraft-cost-month')).getByText('$28.550')).toBeTruthy();
    expect(within(screen.getByTestId('overdraft-cost-total')).getByText('$48.550')).toBeTruthy();
  });

  it('still shows $0 / mo for a real 0% rate, with no prompt (criterion 17)', async () => {
    mockStore({ line: { ...LINE, monthlyRate: 0 }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('overdraft-cost-carrying')).getByText('$0 / mo')).toBeTruthy();
    expect(screen.queryByTestId('carrying-add-rate-button')).toBeNull();
  });

  it('shows the interest-free lower bound with an add-your-rate prompt (criterion 18)', async () => {
    mockStore({ line: UNKNOWN_RATE, events: busyEvents() });
    await render(<OverdraftScreen />);

    const road = screen.getByTestId('overdraft-road');
    expect(
      within(road).getByText('Clears in at least 5 months, not counting interest.'),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('add-rate-button'));
    expect(screen.getByTestId('overdraft-settings-form')).toBeTruthy();
  });

  it('never warns that the payment does not cover the interest without a rate (criterion 18)', async () => {
    mockStore({ line: { ...UNKNOWN_RATE, plannedMonthlyPayment: 20000 }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(
      within(screen.getByTestId('overdraft-road')).queryByText(/doesn.t cover the interest/),
    ).toBeNull();
  });

  it('still prompts for a planned payment when neither a rate nor a payment is set (criterion 18)', async () => {
    mockStore({ line: { ...UNKNOWN_RATE, plannedMonthlyPayment: null }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(screen.getByTestId('set-planned-payment-button')).toBeTruthy();
  });

  it('drops the carrying-cost sentence from the first-use confirmation (criterion 19)', async () => {
    mockStore({ line: UNKNOWN_RATE, events: [] });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '180000');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));
    const confirmation = await screen.findByTestId('overdraft-confirmation');

    expect(within(confirmation).getByText("You're now using your overdraft")).toBeTruthy();
    expect(
      within(confirmation).getByText('Balance $180.000, 9% of your $2.000.000 line.'),
    ).toBeTruthy();
  });

  it('drops the carrying-cost sentence from the crossed-75% confirmation (criterion 19)', async () => {
    mockStore({ line: UNKNOWN_RATE, events: [ev('d', 'draw', 1400000, monthsAgo(1, 3))] });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '120000');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));
    const confirmation = await screen.findByTestId('overdraft-confirmation');

    expect(within(confirmation).getByText('You crossed 75% of your line')).toBeTruthy();
    expect(
      within(confirmation).getByText('Balance $1.520.000, 76%, with $480.000 left.'),
    ).toBeTruthy();
  });
});

describe('OverdraftScreen — Line terms card (addendum, criterion 22)', () => {
  const TERMS_LINE = { ...LINE, monthlyRate: 3.45 };

  it('shows the limit, the monthly rate and the planned payment', async () => {
    mockStore({ line: TERMS_LINE, events: busyEvents() });
    await render(<OverdraftScreen />);

    const terms = screen.getByTestId('overdraft-terms');
    expect(within(terms).getByText('Line terms')).toBeTruthy();
    expect(within(screen.getByTestId('terms-limit')).getByText('$2.000.000')).toBeTruthy();
    expect(within(screen.getByTestId('terms-rate')).getByText('3.45%')).toBeTruthy();
    expect(within(screen.getByTestId('terms-planned')).getByText('$300.000 / month')).toBeTruthy();
  });

  it('shows the card even with no events', async () => {
    mockStore({ line: TERMS_LINE, events: [] });
    await render(<OverdraftScreen />);

    expect(screen.getByTestId('overdraft-terms')).toBeTruthy();
  });

  it('opens the settings form from the card’s Edit button, the only Edit-settings control on the screen', async () => {
    mockStore({ line: TERMS_LINE, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(screen.getAllByTestId('edit-overdraft-settings-button')).toHaveLength(1);
    await fireEvent.press(
      within(screen.getByTestId('overdraft-terms')).getByTestId('edit-overdraft-settings-button'),
    );

    expect(screen.getByTestId('overdraft-settings-form')).toBeTruthy();
  });

  it('shows "Not set · Add" for an unknown rate, and it opens the settings form', async () => {
    mockStore({ line: { ...LINE, monthlyRate: null }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('terms-rate')).getByText('Not set · Add')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('terms-add-rate-button'));

    expect(screen.getByTestId('overdraft-settings-form')).toBeTruthy();
  });

  it('shows a real 0% rate as "0%", not as not set', async () => {
    mockStore({ line: { ...LINE, monthlyRate: 0 }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('terms-rate')).getByText('0%')).toBeTruthy();
    expect(screen.queryByTestId('terms-add-rate-button')).toBeNull();
  });

  it('shows "Not set · Add" for an unset planned payment, and it opens the settings form', async () => {
    mockStore({ line: { ...TERMS_LINE, plannedMonthlyPayment: null }, events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(within(screen.getByTestId('terms-planned')).getByText('Not set · Add')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('terms-add-payment-button'));

    expect(screen.getByTestId('overdraft-settings-form')).toBeTruthy();
  });

  it('is not shown in the first-run setup state', async () => {
    mockStore({ line: null });
    await render(<OverdraftScreen />);

    expect(screen.queryByTestId('overdraft-terms')).toBeNull();
  });
});

describe('OverdraftScreen — narrow/native (addendum criterion 23: no wide rail/column)', () => {
  it('renders the existing single-column layout, with no rail or wide-column wrapper', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    expect(screen.queryByTestId('overdraft-rail')).toBeNull();
    expect(screen.queryByTestId('overdraft-wide-column')).toBeNull();
    expect(screen.getByTestId('overdraft-gauge')).toBeTruthy();
    expect(screen.getByTestId('overdraft-terms')).toBeTruthy();
  });
});

describe('OverdraftScreen — logging (criteria 5, 6, 7)', () => {
  it('logs a draw through logDraw only, with the amount, a date and the note', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '150000');
    await fireEvent.changeText(screen.getByTestId('overdraft-note-input'), 'Auto top-up');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    expect(store.logDraw).toHaveBeenCalledWith({
      amount: 150000,
      date: expect.any(Date),
      note: 'Auto top-up',
    });
    expect(store.logPayment).not.toHaveBeenCalled();
    expect(store.logInterest).not.toHaveBeenCalled();
    expect(store.logFee).not.toHaveBeenCalled();
  });

  it('stores a blank note as null', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '150000');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    expect(store.logDraw).toHaveBeenCalledWith(expect.objectContaining({ note: null }));
  });

  it('accepts a draw that takes the balance past the limit (criterion 7)', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '900000');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    expect(store.logDraw).toHaveBeenCalledWith(expect.objectContaining({ amount: 900000 }));
  });

  it('logs a payment through logPayment only', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-payment-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '300000');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    expect(store.logPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 300000 }));
    expect(store.logDraw).not.toHaveBeenCalled();
  });

  it('rejects a payment greater than the current balance (criterion 7)', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-payment-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '1240001');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    expect(store.logPayment).not.toHaveBeenCalled();
    expect(screen.getByText('Payment can’t be more than the current balance.')).toBeTruthy();
  });

  it('logs interest and fees through their own store actions', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-interest-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '23560');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));
    expect(store.logInterest).toHaveBeenCalledWith(expect.objectContaining({ amount: 23560 }));

    await fireEvent.press(screen.getByTestId('log-fee-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '4990');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));
    expect(store.logFee).toHaveBeenCalledWith(expect.objectContaining({ amount: 4990 }));
  });

  it.each([
    ['0', 'Amount must be greater than zero.'],
    ['-100', 'Enter a whole number in pesos — no decimals or symbols.'],
    ['1500.50', 'Enter a whole number in pesos — no decimals or symbols.'],
    ['', 'Enter an amount.'],
  ])('rejects the amount %p with an inline error, saving nothing', async (raw, message) => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), raw);
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    expect(store.logDraw).not.toHaveBeenCalled();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('closes the form after a save that crosses nothing, with no confirmation', async () => {
    mockStore({ events: [ev('d', 'draw', 300000, monthsAgo(1, 3))] });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), '100000');
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));

    await screen.findByTestId('log-draw-button');
    expect(screen.queryByTestId('overdraft-form')).toBeNull();
    expect(screen.queryByTestId('overdraft-confirmation')).toBeNull();
  });

  it('cancels a form without saving', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.press(screen.getByTestId('cancel-overdraft-button'));

    expect(screen.queryByTestId('overdraft-form')).toBeNull();
    expect(store.logDraw).not.toHaveBeenCalled();
  });
});

describe('OverdraftScreen — confirmations (criterion 10)', () => {
  async function saveDraw(amount: string) {
    await fireEvent.press(screen.getByTestId('log-draw-button'));
    await fireEvent.changeText(screen.getByTestId('overdraft-amount-input'), amount);
    await fireEvent.press(screen.getByTestId('confirm-overdraft-button'));
    return screen.findByTestId('overdraft-confirmation');
  }

  it('tells you plainly the first time a draw takes the balance above zero', async () => {
    mockStore({ events: [] });
    await render(<OverdraftScreen />);

    const confirmation = await saveDraw('180000');

    expect(within(confirmation).getByText("You're now using your overdraft")).toBeTruthy();
    expect(
      within(confirmation).getByText(
        'Balance $180.000, 9% of your $2.000.000 line. At 1.9% a month, carrying this costs about $3.420 a month.',
      ),
    ).toBeTruthy();
    expect(flat('overdraft-confirmation').backgroundColor).toBe(colors.status.notice.tone);
  });

  it('warns when a draw crosses 75% of the line', async () => {
    mockStore({ events: [ev('d', 'draw', 1400000, monthsAgo(1, 3))] });
    await render(<OverdraftScreen />);

    const confirmation = await saveDraw('120000');

    expect(within(confirmation).getByText('You crossed 75% of your line')).toBeTruthy();
    expect(
      within(confirmation).getByText(
        'Balance $1.520.000, 76%, with $480.000 left. Carrying cost is now about $28.880 a month.',
      ),
    ).toBeTruthy();
    expect(flat('overdraft-confirmation').backgroundColor).toBe(colors.status.warning.tone);
  });

  it('warns critically when a draw takes the balance over the limit', async () => {
    mockStore({ events: [ev('d', 'draw', 1900000, monthsAgo(1, 3))] });
    await render(<OverdraftScreen />);

    const confirmation = await saveDraw('200000');

    expect(within(confirmation).getByText("You're now over your limit")).toBeTruthy();
    expect(
      within(confirmation).getByText('Balance $2.100.000, 105% of your line — $100.000 over.'),
    ).toBeTruthy();
    expect(flat('overdraft-confirmation').backgroundColor).toBe(colors.status.critical.tone);
  });

  it('dismisses with "Got it"', async () => {
    mockStore({ events: [] });
    await render(<OverdraftScreen />);
    await saveDraw('180000');

    await fireEvent.press(screen.getByTestId('dismiss-confirmation-button'));

    expect(screen.queryByTestId('overdraft-confirmation')).toBeNull();
  });
});

describe('OverdraftScreen — line settings (criterion 15)', () => {
  it('opens a form prefilled with the current settings and saves the edit through updateLine, creating no event', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('edit-overdraft-settings-button'));

    expect(screen.getByTestId('settings-limit-input').props.value).toBe('2000000');
    expect(screen.getByTestId('settings-rate-input').props.value).toBe('1.9');
    expect(screen.getByTestId('settings-planned-payment-input').props.value).toBe('300000');

    await fireEvent.changeText(screen.getByTestId('settings-rate-input'), '2.1');
    await fireEvent.press(screen.getByTestId('save-overdraft-settings-button'));

    expect(store.updateLine).toHaveBeenCalledWith({
      limit: 2000000,
      monthlyRate: 2.1,
      plannedMonthlyPayment: 300000,
    });
    expect(store.logDraw).not.toHaveBeenCalled();
    expect(store.logPayment).not.toHaveBeenCalled();
    expect(store.logInterest).not.toHaveBeenCalled();
    expect(store.logFee).not.toHaveBeenCalled();
  });

  it('labels the rate field as optional in the settings form too (addendum, criterion 21)', async () => {
    mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('edit-overdraft-settings-button'));

    expect(
      within(screen.getByTestId('overdraft-settings-form')).getByText('Monthly rate, % (optional)'),
    ).toBeTruthy();
  });

  it('clears the rate when the field is left blank, saving null and creating no event (amendment, criterion 20)', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('edit-overdraft-settings-button'));
    await fireEvent.changeText(screen.getByTestId('settings-rate-input'), '');
    await fireEvent.press(screen.getByTestId('save-overdraft-settings-button'));

    expect(store.updateLine).toHaveBeenCalledWith({
      limit: 2000000,
      monthlyRate: null,
      plannedMonthlyPayment: 300000,
    });
    expect(store.logDraw).not.toHaveBeenCalled();
    expect(store.logInterest).not.toHaveBeenCalled();
  });

  it('opens with a blank rate field when the rate is unknown, and sets one (amendment, criterion 20)', async () => {
    const store = mockStore({ line: { ...LINE, monthlyRate: null }, events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('edit-overdraft-settings-button'));
    expect(screen.getByTestId('settings-rate-input').props.value).toBe('');

    await fireEvent.changeText(screen.getByTestId('settings-rate-input'), '1.9');
    await fireEvent.press(screen.getByTestId('save-overdraft-settings-button'));

    expect(store.updateLine).toHaveBeenCalledWith(expect.objectContaining({ monthlyRate: 1.9 }));
  });

  it('rejects an invalid limit without saving', async () => {
    const store = mockStore({ events: busyEvents() });
    await render(<OverdraftScreen />);

    await fireEvent.press(screen.getByTestId('edit-overdraft-settings-button'));
    await fireEvent.changeText(screen.getByTestId('settings-limit-input'), '0');
    await fireEvent.press(screen.getByTestId('save-overdraft-settings-button'));

    expect(store.updateLine).not.toHaveBeenCalled();
    expect(screen.getByText('Amount must be greater than zero.')).toBeTruthy();
  });
});
