const mockSignInWithRedirect = jest.fn();
const mockSignInWithPopup = jest.fn();
const mockSignOut = jest.fn();
const mockOnAuthStateChanged = jest.fn(() => jest.fn());

// jest.mock() factories are hoisted above other module-level code, so the
// mock class must be defined inline here rather than referenced from an
// externally-declared class (see the same lesson already noted in the
// native Firestore repo tests).
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: class MockGoogleAuthProvider {},
  signInWithRedirect: (...args: unknown[]) => mockSignInWithRedirect(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

const fakeAuth = { currentUser: null };

jest.mock('../firebaseApp', () => ({
  auth: fakeAuth,
}));

import { GoogleAuthProvider } from 'firebase/auth';
import { googleAuthProvider } from '../googleAuthProvider.web';

describe('googleAuthProvider (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs in via redirect, not a popup (regression: Safari ITP breaks signInWithPopup + Firestore auth)', async () => {
    mockSignInWithRedirect.mockResolvedValue(undefined);

    await googleAuthProvider.signIn();

    expect(mockSignInWithRedirect).toHaveBeenCalledWith(fakeAuth, expect.any(GoogleAuthProvider));
    expect(mockSignInWithPopup).not.toHaveBeenCalled();
  });
});
