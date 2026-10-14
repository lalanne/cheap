import type { AuthProvider, AuthUser, EmailAuthProvider } from '../types';
import { createAuthStore } from '../authStore';

function createMockProviders() {
  let listener: ((user: AuthUser | null) => void) | null = null;
  let currentUser: AuthUser | null = null;

  const google: AuthProvider = {
    signIn: jest.fn(async () => {
      currentUser = {
        uid: 'google-uid',
        email: 'user@gmail.com',
        displayName: 'Google User',
        photoUrl: 'https://example.com/photo.jpg',
        emailVerified: true,
      };
      listener?.(currentUser);
      return currentUser;
    }),
    signOut: jest.fn(async () => {
      currentUser = null;
      listener?.(null);
    }),
    onAuthStateChanged: jest.fn((callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    }),
  };

  const email: EmailAuthProvider = {
    signUp: jest.fn(async (name: string, emailAddress: string) => {
      currentUser = {
        uid: 'email-uid',
        email: emailAddress,
        displayName: name,
        photoUrl: null,
        emailVerified: false,
      };
      listener?.(currentUser);
      return currentUser;
    }),
    signIn: jest.fn(async (emailAddress: string) => {
      currentUser = {
        uid: 'email-uid',
        email: emailAddress,
        displayName: 'Returning User',
        photoUrl: null,
        emailVerified: true,
      };
      listener?.(currentUser);
      return currentUser;
    }),
    sendPasswordReset: jest.fn(async () => {}),
    resendVerificationEmail: jest.fn(async () => {}),
    reloadCurrentUser: jest.fn(async () => currentUser),
  };

  return { google, email, fireAuthStateChanged: (user: AuthUser | null) => listener?.(user) };
}

describe('authStore', () => {
  it('starts initializing, then reflects the provider reporting signed-out', () => {
    const providers = createMockProviders();
    const useAuthStore = createAuthStore(providers);

    expect(useAuthStore.getState().status).toBe('initializing');

    providers.fireAuthStateChanged(null);

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('sign-up creates an unverified, signed-in user (criterion 2)', async () => {
    const providers = createMockProviders();
    const useAuthStore = createAuthStore(providers);

    await useAuthStore.getState().signUpWithEmail('Jane', 'jane@example.com', 'password123');

    expect(providers.email.signUp).toHaveBeenCalledWith('Jane', 'jane@example.com', 'password123');
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().user).toMatchObject({
      email: 'jane@example.com',
      emailVerified: false,
    });
  });

  it('refreshEmailVerified stays gated until the provider reports verified (criterion 4)', async () => {
    const providers = createMockProviders();
    const useAuthStore = createAuthStore(providers);
    await useAuthStore.getState().signUpWithEmail('Jane', 'jane@example.com', 'password123');

    // Not clicked the link yet — reloadCurrentUser still reports unverified.
    await useAuthStore.getState().refreshEmailVerified();
    expect(useAuthStore.getState().user?.emailVerified).toBe(false);

    // Simulate clicking the verification link.
    (providers.email.reloadCurrentUser as jest.Mock).mockResolvedValueOnce({
      uid: 'email-uid',
      email: 'jane@example.com',
      displayName: 'Jane',
      photoUrl: null,
      emailVerified: true,
    });

    await useAuthStore.getState().refreshEmailVerified();
    expect(useAuthStore.getState().user?.emailVerified).toBe(true);
    expect(useAuthStore.getState().status).toBe('signedIn');
  });

  it('email sign-in converges on the same status Google sign-in would (criterion 5)', async () => {
    const providers = createMockProviders();
    const useAuthStore = createAuthStore(providers);

    await useAuthStore.getState().signInWithEmail('jane@example.com', 'password123');

    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().user?.emailVerified).toBe(true);
  });

  it('swallows a not-found error from password reset so no email-enumeration oracle exists (criterion 7)', async () => {
    const providers = createMockProviders();
    (providers.email.sendPasswordReset as jest.Mock).mockRejectedValueOnce({
      code: 'auth/user-not-found',
    });
    const useAuthStore = createAuthStore(providers);

    await expect(
      useAuthStore.getState().sendPasswordReset('nobody@example.com'),
    ).resolves.toBeUndefined();
  });

  it('rethrows a mapped error from password reset for anything other than not-found', async () => {
    const providers = createMockProviders();
    (providers.email.sendPasswordReset as jest.Mock).mockRejectedValueOnce({
      code: 'auth/too-many-requests',
    });
    const useAuthStore = createAuthStore(providers);

    await expect(
      useAuthStore.getState().sendPasswordReset('jane@example.com'),
    ).rejects.toMatchObject({ message: 'Too many attempts. Try again later.' });
  });

  it('rethrows a mapped error when sign-up fails (criterion 8)', async () => {
    const providers = createMockProviders();
    (providers.email.signUp as jest.Mock).mockRejectedValueOnce({
      code: 'auth/email-already-in-use',
    });
    const useAuthStore = createAuthStore(providers);

    await expect(
      useAuthStore.getState().signUpWithEmail('Jane', 'jane@example.com', 'password123'),
    ).rejects.toMatchObject({
      message:
        'An account with this email already exists — sign in or continue with Google instead.',
    });
  });

  it('swallows a cancelled native Google sign-in without throwing (dismissing the picker is not an error)', async () => {
    const providers = createMockProviders();
    (providers.google.signIn as jest.Mock).mockRejectedValueOnce({
      code: 'auth/sign-in-cancelled',
    });
    const useAuthStore = createAuthStore(providers);

    await expect(useAuthStore.getState().signInWithGoogle()).resolves.toBeUndefined();
  });

  it('rethrows a mapped error when Google sign-in fails for a real reason', async () => {
    const providers = createMockProviders();
    (providers.google.signIn as jest.Mock).mockRejectedValueOnce({
      code: 'app/not-configured',
    });
    const useAuthStore = createAuthStore(providers);

    await expect(useAuthStore.getState().signInWithGoogle()).rejects.toMatchObject({
      message: "Sign-in isn't set up yet — check back soon.",
    });
  });

  it('sign-out clears the user and returns to signed-out (criterion 10)', async () => {
    const providers = createMockProviders();
    const useAuthStore = createAuthStore(providers);
    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().status).toBe('signedIn');

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
// tmp
