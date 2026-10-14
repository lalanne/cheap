const mockHasPlayServices = jest.fn();
const mockGoogleSignIn = jest.fn();
const mockGoogleSignOut = jest.fn();
const mockConfigure = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signIn: (...args: unknown[]) => mockGoogleSignIn(...args),
    signOut: (...args: unknown[]) => mockGoogleSignOut(...args),
  },
  isCancelledResponse: (response: { type: string }) => response.type === 'cancelled',
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
}));

const mockSignInWithCredential = jest.fn();
const mockCredential = jest.fn((idToken: string) => ({ idToken }));
const mockOnAuthStateChanged = jest.fn();
const mockSignOut = jest.fn();

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  GoogleAuthProvider: { credential: (idToken: string) => mockCredential(idToken) },
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInWithCredential: (...args: unknown[]) => mockSignInWithCredential(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

import { googleAuthProvider } from '../googleAuthProvider.native';

const ORIGINAL_ENV = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'test-web-client-id';
  mockHasPlayServices.mockResolvedValue(true);
});

afterAll(() => {
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = ORIGINAL_ENV;
});

describe('googleAuthProvider (native)', () => {
  it('exchanges a Google ID token for a Firebase credential (criterion 12)', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token' } });
    mockSignInWithCredential.mockResolvedValue({
      user: {
        uid: 'uid-1',
        email: 'ana@example.com',
        displayName: 'Ana',
        photoURL: null,
        emailVerified: true,
      },
    });

    const user = await googleAuthProvider.signIn();

    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'test-web-client-id' });
    expect(mockCredential).toHaveBeenCalledWith('id-token');
    expect(mockSignInWithCredential).toHaveBeenCalledWith(expect.anything(), {
      idToken: 'id-token',
    });
    expect(user).toEqual({
      uid: 'uid-1',
      email: 'ana@example.com',
      displayName: 'Ana',
      photoUrl: null,
      emailVerified: true,
    });
  });

  it('maps a dismissed picker to the shared cancellation sentinel, not a real error', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'cancelled' });

    await expect(googleAuthProvider.signIn()).rejects.toMatchObject({
      code: 'auth/sign-in-cancelled',
    });
    expect(mockSignInWithCredential).not.toHaveBeenCalled();
  });

  it('throws a clear error when the web client id is not configured', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

    await expect(googleAuthProvider.signIn()).rejects.toMatchObject({
      code: 'app/not-configured',
    });
    expect(mockGoogleSignIn).not.toHaveBeenCalled();
  });
});
