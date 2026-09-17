import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import { useAuthStore } from '../auth/store';
import App from '../../App';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

jest.mock('../auth/store', () => ({
  useAuthStore: jest.fn(),
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
  beforeEach(() => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);
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

  it('shows the main app once signed in and verified', async () => {
    mockAuthState({ status: 'signedIn', user: { emailVerified: true } });

    await render(<App />);

    expect(screen.getByTestId('main-app')).toBeTruthy();
  });
});
