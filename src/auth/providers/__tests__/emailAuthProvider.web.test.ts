const mockCreateUser = jest.fn();
const mockSignIn = jest.fn();
const mockSendPasswordReset = jest.fn();
const mockSendEmailVerification = jest.fn();
const mockUpdateProfile = jest.fn();
const mockGetIdToken = jest.fn();

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: (...args: unknown[]) => mockCreateUser(...args),
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordReset(...args),
  sendEmailVerification: (...args: unknown[]) => mockSendEmailVerification(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
}));

const mockReload = jest.fn();
const fakeUser = {
  uid: 'uid-1',
  email: 'jane@example.com',
  displayName: 'Jane',
  photoURL: null,
  emailVerified: false,
  reload: (...args: unknown[]) => mockReload(...args),
};

jest.mock('../firebaseApp', () => ({
  auth: { currentUser: fakeUser },
}));

import { emailAuthProvider } from '../emailAuthProvider.web';

describe('emailAuthProvider (web)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forces an ID token refresh after reload — Firestore rules read the token claim, not the profile (regression: da2 spec 001)', async () => {
    mockReload.mockResolvedValue(undefined);
    mockGetIdToken.mockResolvedValue('fresh-token');

    await emailAuthProvider.reloadCurrentUser();

    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(mockGetIdToken).toHaveBeenCalledWith(fakeUser, true);
  });

  it('signs up, sets the display name, and sends a verification email', async () => {
    mockCreateUser.mockResolvedValue({ user: fakeUser });

    await emailAuthProvider.signUp('Jane', 'jane@example.com', 'password123');

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.anything(),
      'jane@example.com',
      'password123',
    );
    expect(mockUpdateProfile).toHaveBeenCalledWith(fakeUser, { displayName: 'Jane' });
    expect(mockSendEmailVerification).toHaveBeenCalledWith(fakeUser);
  });
});
