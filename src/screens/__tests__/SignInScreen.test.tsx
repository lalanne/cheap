import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '../../auth/store';
import { SignInScreen } from '../SignInScreen';

jest.mock('../../auth/store', () => ({
  useAuthStore: jest.fn(),
}));

function mockStore(overrides: Partial<Record<string, jest.Mock>> = {}) {
  const state = {
    signInWithGoogle: jest.fn(),
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
    sendPasswordReset: jest.fn(),
    ...overrides,
  };
  (useAuthStore as unknown as jest.Mock).mockImplementation((selector: (s: typeof state) => unknown) =>
    selector(state)
  );
  return state;
}

describe('SignInScreen', () => {
  it('calls signInWithGoogle when the Google button is pressed', async () => {
    const store = mockStore();
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByTestId('google-button'));

    expect(store.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('shows the mapped error when Google sign-in fails for a real reason', async () => {
    const store = mockStore({
      signInWithGoogle: jest.fn().mockRejectedValue({ message: "Sign-in isn't set up yet — check back soon." }),
    });
    await render(<SignInScreen />);

    await fireEvent.press(screen.getByTestId('google-button'));

    expect(store.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Sign-in isn't set up yet — check back soon.")).toBeTruthy();
  });

  it('toggling to "Create account" reveals the name field', async () => {
    mockStore();
    await render(<SignInScreen />);

    expect(screen.queryByTestId('name-input')).toBeNull();

    await fireEvent.press(screen.getByTestId('tab-signup'));

    expect(screen.getByTestId('name-input')).toBeTruthy();
  });

  it('submits sign-in with the entered email and password (criterion 5)', async () => {
    const store = mockStore();
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(store.signInWithEmail).toHaveBeenCalledWith('jane@example.com', 'password123');
  });

  it('submits sign-up with name, email, and password once toggled (criterion 2)', async () => {
    const store = mockStore();
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByTestId('tab-signup'));

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Jane');
    await fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'password123');
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(store.signUpWithEmail).toHaveBeenCalledWith('Jane', 'jane@example.com', 'password123');
  });

  it('blocks sign-up with a short password before calling the store', async () => {
    const store = mockStore();
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByTestId('tab-signup'));

    await fireEvent.changeText(screen.getByTestId('name-input'), 'Jane');
    await fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'short');
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(store.signUpWithEmail).not.toHaveBeenCalled();
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
  });

  it('shows the mapped error message when sign-in fails (criterion 6)', async () => {
    const store = mockStore({
      signInWithEmail: jest.fn().mockRejectedValue({ message: 'Incorrect email or password.' }),
    });
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByTestId('email-input'), 'jane@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'wrongpassword');
    await fireEvent.press(screen.getByTestId('submit-button'));

    expect(store.signInWithEmail).toHaveBeenCalled();
    expect(screen.getByText('Incorrect email or password.')).toBeTruthy();
  });

  it('sends a password reset and shows the same confirmation regardless of outcome (criterion 7)', async () => {
    const store = mockStore();
    await render(<SignInScreen />);

    await fireEvent.changeText(screen.getByTestId('email-input'), 'nobody@example.com');
    await fireEvent.press(screen.getByTestId('forgot-password'));

    expect(store.sendPasswordReset).toHaveBeenCalledWith('nobody@example.com');
    expect(screen.getByTestId('reset-confirmation')).toBeTruthy();
  });
});
