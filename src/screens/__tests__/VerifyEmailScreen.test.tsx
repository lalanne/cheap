import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '../../auth/store';
import { VerifyEmailScreen } from '../VerifyEmailScreen';

jest.mock('../../auth/store', () => ({
  useAuthStore: jest.fn(),
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    user: { email: 'jane@example.com' },
    resendVerificationEmail: jest.fn(),
    refreshEmailVerified: jest.fn(),
    signOut: jest.fn(),
    ...overrides,
  };
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
  return state;
}

describe('VerifyEmailScreen', () => {
  it("shows the account's email address", async () => {
    mockStore();
    await render(<VerifyEmailScreen />);

    expect(screen.getByText('jane@example.com')).toBeTruthy();
  });

  it('resends the verification email on request', async () => {
    const store = mockStore();
    await render(<VerifyEmailScreen />);

    await fireEvent.press(screen.getByTestId('resend-button'));

    expect(store.resendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('checks verification status when "I\'ve verified" is tapped (criterion 4)', async () => {
    const store = mockStore();
    await render(<VerifyEmailScreen />);

    await fireEvent.press(screen.getByTestId('ive-verified-button'));

    expect(store.refreshEmailVerified).toHaveBeenCalledTimes(1);
  });

  it('signs out via the escape hatch (criterion 10)', async () => {
    const store = mockStore();
    await render(<VerifyEmailScreen />);

    await fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(store.signOut).toHaveBeenCalledTimes(1);
  });
});
