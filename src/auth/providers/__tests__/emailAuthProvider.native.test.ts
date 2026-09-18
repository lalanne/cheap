const mockCreateUser = jest.fn();
const mockSignIn = jest.fn();
const mockSendPasswordReset = jest.fn();
const mockSendEmailVerification = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetIdToken = jest.fn();
const mockReload = jest.fn();
const mockGetAuth = jest.fn();

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUser(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordReset(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  reload: (...args: unknown[]) => mockReload(...args),
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
}));

import { emailAuthProvider } from '../emailAuthProvider.native';

const fakeUser = {
  uid: 'uid-1',
  email: 'jane@example.com',
  displayName: 'Jane',
  photoURL: null,
  emailVerified: false,
};

describe('emailAuthProvider (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuth.mockReturnValue({ currentUser: fakeUser });
  });

  it('forces an ID token refresh after reload, not just the profile (da2 regression)', async () => {
    mockReload.mockResolvedValue(undefined);
    mockGetIdToken.mockResolvedValue('fresh-token');

    await emailAuthProvider.reloadCurrentUser();

    expect(mockReload).toHaveBeenCalledWith(fakeUser);
    expect(mockGetIdToken).toHaveBeenCalledWith(fakeUser, true);
  });

  it('signs up, sets the display name, and sends a verification email with explicit actionCodeSettings', async () => {
    mockCreateUser.mockResolvedValue({ user: fakeUser });

    await emailAuthProvider.signUp('Jane', 'jane@example.com', 'password123');

    expect(mockCreateUser).toHaveBeenCalledWith(expect.anything(), 'jane@example.com', 'password123');
    expect(mockUpdateProfile).toHaveBeenCalledWith(fakeUser, { displayName: 'Jane' });
    // Explicit actionCodeSettings required — omitting it throws inside the
    // native SDK post-Dynamic-Links-shutdown (da2's spec 001 finding).
    expect(mockSendEmailVerification).toHaveBeenCalledWith(
      fakeUser,
      expect.objectContaining({ url: expect.any(String), handleCodeInApp: false })
    );
  });

  it('sends a password reset with explicit actionCodeSettings too', async () => {
    await emailAuthProvider.sendPasswordReset('jane@example.com');

    expect(mockSendPasswordReset).toHaveBeenCalledWith(
      expect.anything(),
      'jane@example.com',
      expect.objectContaining({ url: expect.any(String), handleCodeInApp: false })
    );
  });
});
