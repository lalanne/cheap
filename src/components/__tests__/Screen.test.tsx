import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { Screen } from '../Screen';

const mockInsets = { top: 47, bottom: 34, left: 0, right: 0 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

describe('Screen', () => {
  it('renders its children', async () => {
    await render(
      <Screen>
        <Text>Transactions</Text>
      </Screen>,
    );

    expect(screen.getByText('Transactions')).toBeTruthy();
  });

  it("pads content below the device's safe-area top inset (criterion 4)", async () => {
    await render(
      <Screen>
        <Text>Transactions</Text>
      </Screen>,
    );

    const scrollView = screen.getByTestId('screen-scroll-view');
    const contentStyle = [].concat(scrollView.props.contentContainerStyle);
    const paddingTop = contentStyle.reduce(
      (found: number | undefined, s: { paddingTop?: number }) => s?.paddingTop ?? found,
      undefined,
    );
    expect(paddingTop).toBeGreaterThanOrEqual(mockInsets.top);
  });

  it('pads content above the safe-area bottom inset', async () => {
    await render(
      <Screen>
        <Text>Transactions</Text>
      </Screen>,
    );

    const scrollView = screen.getByTestId('screen-scroll-view');
    const contentStyle = [].concat(scrollView.props.contentContainerStyle);
    const paddingBottom = contentStyle.reduce(
      (found: number | undefined, s: { paddingBottom?: number }) => s?.paddingBottom ?? found,
      undefined,
    );
    expect(paddingBottom).toBeGreaterThanOrEqual(mockInsets.bottom);
  });

  it('scrolls and lets taps through while the keyboard is open (criterion 5)', async () => {
    await render(
      <Screen>
        <Text>Transactions</Text>
      </Screen>,
    );

    const scrollView = screen.getByTestId('screen-scroll-view');
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scrollView.props.keyboardDismissMode).toBe('on-drag');
  });

  it('caps and centers content width on web (spec 006 criterion 5)', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'web';
    try {
      await render(
        <Screen>
          <Text>Transactions</Text>
        </Screen>,
      );

      const scrollView = screen.getByTestId('screen-scroll-view');
      const contentStyle = [].concat(scrollView.props.contentContainerStyle);
      const flat = Object.assign({}, ...contentStyle);
      expect(flat.maxWidth).toBe(560);
      expect(flat.alignSelf).toBe('center');
      expect(flat.width).toBe('100%');
    } finally {
      Platform.OS = originalOS;
    }
  });

  it('uses a wider cap on web when wide is set (regression: master-detail crushed to ~130px inside the 560px cap)', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'web';
    try {
      await render(
        <Screen wide>
          <Text>Transactions</Text>
        </Screen>,
      );

      const scrollView = screen.getByTestId('screen-scroll-view');
      const contentStyle = [].concat(scrollView.props.contentContainerStyle);
      const flat = Object.assign({}, ...contentStyle);
      expect(flat.maxWidth).toBeGreaterThan(560);
    } finally {
      Platform.OS = originalOS;
    }
  });
});
