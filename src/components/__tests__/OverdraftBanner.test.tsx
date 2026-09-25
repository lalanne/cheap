import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { useOverdraftStore } from '../../overdraft/store';
import type { OverdraftEvent, OverdraftLine } from '../../overdraft/types';
import { colors } from '../../theme/tokens';
import { OverdraftBanner } from '../OverdraftBanner';

jest.mock('../../overdraft/store', () => ({
  useOverdraftStore: jest.fn(),
}));

const LINE: OverdraftLine = {
  limit: 2000000,
  monthlyRate: 1.9,
  plannedMonthlyPayment: 300000,
  createdAt: new Date(2026, 3, 1),
  updatedAt: new Date(2026, 3, 1),
};

function draw(amount: number, date: Date, id = 'e-1'): OverdraftEvent {
  return { id, type: 'draw', amount, date, note: null, transactionId: null, createdAt: date };
}

function mockStore(line: OverdraftLine | null, events: OverdraftEvent[]) {
  (useOverdraftStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: { line: OverdraftLine | null; events: OverdraftEvent[] }) => unknown) =>
      selector({ line, events })
  );
}

function bannerStyle() {
  return StyleSheet.flatten(screen.getByTestId('overdraft-banner').props.style) as Record<string, unknown>;
}

const APR_9 = new Date(2026, 3, 9);

describe('OverdraftBanner (spec 012 criterion 10)', () => {
  it('is absent when no line has been set up', async () => {
    mockStore(null, []);
    await render(<OverdraftBanner />);

    expect(screen.queryByTestId('overdraft-banner')).toBeNull();
  });

  it('is absent while the balance is zero (unused)', async () => {
    mockStore(LINE, []);
    await render(<OverdraftBanner />);

    expect(screen.queryByTestId('overdraft-banner')).toBeNull();
  });

  it('is absent once the balance has returned to zero', async () => {
    mockStore(LINE, [
      draw(100000, APR_9, 'e-1'),
      { ...draw(100000, new Date(2026, 4, 1), 'e-2'), type: 'payment' },
    ]);
    await render(<OverdraftBanner />);

    expect(screen.queryByTestId('overdraft-banner')).toBeNull();
  });

  it('shows the used amount, percent and start date when in use, in the notice style', async () => {
    mockStore(LINE, [draw(1240000, APR_9)]);
    await render(<OverdraftBanner />);

    expect(screen.getByText('In overdraft · 62% of your line')).toBeTruthy();
    expect(screen.getByText('$1.240.000 of $2.000.000 · since Apr 9')).toBeTruthy();
    expect(bannerStyle().backgroundColor).toBe(colors.status.notice.tone);
  });

  it('says "now using" when the balance went above zero today', async () => {
    mockStore(LINE, [draw(180000, new Date())]);
    await render(<OverdraftBanner />);

    expect(screen.getByText("You're now using your overdraft")).toBeTruthy();
    expect(screen.getByText('$180.000 of $2.000.000 (9%) · since today')).toBeTruthy();
    expect(bannerStyle().backgroundColor).toBe(colors.status.notice.tone);
  });

  it('escalates to the warning style from 75%, with the amount left', async () => {
    mockStore(LINE, [draw(1560000, APR_9)]);
    await render(<OverdraftBanner />);

    expect(screen.getByText('Getting close to your limit · 78%')).toBeTruthy();
    expect(screen.getByText('$1.560.000 of $2.000.000 · $440.000 left · since Apr 9')).toBeTruthy();
    expect(bannerStyle().backgroundColor).toBe(colors.status.warning.tone);
  });

  it('escalates to the critical style over the limit, with how far over', async () => {
    mockStore(LINE, [draw(2120000, APR_9)]);
    await render(<OverdraftBanner />);

    expect(screen.getByText('Over your limit by $120.000')).toBeTruthy();
    expect(screen.getByText('$2.120.000 of $2.000.000 (106%) · since Apr 9')).toBeTruthy();
    expect(bannerStyle().backgroundColor).toBe(colors.status.critical.tone);
  });

  it('calls onPress when tapped, so the shell can open the Overdraft tab', async () => {
    mockStore(LINE, [draw(1240000, APR_9)]);
    const onPress = jest.fn();
    await render(<OverdraftBanner onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('overdraft-banner'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
