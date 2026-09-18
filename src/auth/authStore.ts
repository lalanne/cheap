import { create } from 'zustand';

import { mapAuthError } from './mapAuthError';
import type { AuthErrorLike, AuthProvider, AuthUser, EmailAuthProvider } from './types';

type AuthStatus = 'initializing' | 'signedOut' | 'signedIn';

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
};

type AuthActions = {
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerified: () => Promise<void>;
  signOut: () => Promise<void>;
};

export type AuthStore = AuthState & AuthActions;

export type AuthProviders = {
  google: AuthProvider;
  email: EmailAuthProvider;
};

export function createAuthStore(providers: AuthProviders) {
  const useAuthStore = create<AuthStore>()((set) => ({
    user: null,
    status: 'initializing',

    signInWithGoogle: async () => {
      try {
        await providers.google.signIn();
      } catch (error) {
        // Dismissing the native picker (or the web popup) isn't an error a
        // user should see — same as closing any other cancelable dialog.
        if ((error as AuthErrorLike)?.code === 'auth/sign-in-cancelled') {
          return;
        }
        throw mapAuthError(error as AuthErrorLike);
      }
    },

    signUpWithEmail: async (name, email, password) => {
      try {
        await providers.email.signUp(name, email, password);
      } catch (error) {
        throw mapAuthError(error as AuthErrorLike);
      }
    },

    signInWithEmail: async (email, password) => {
      try {
        await providers.email.signIn(email, password);
      } catch (error) {
        throw mapAuthError(error as AuthErrorLike);
      }
    },

    sendPasswordReset: async (email) => {
      try {
        await providers.email.sendPasswordReset(email);
      } catch (error) {
        // Never reveal whether the account exists — swallow not-found and
        // let the UI show the same confirmation either way (criterion 7).
        if ((error as AuthErrorLike)?.code === 'auth/user-not-found') {
          return;
        }
        throw mapAuthError(error as AuthErrorLike);
      }
    },

    resendVerificationEmail: async () => {
      await providers.email.resendVerificationEmail();
    },

    refreshEmailVerified: async () => {
      const user = await providers.email.reloadCurrentUser();
      if (user) {
        set({ user, status: 'signedIn' });
      }
    },

    signOut: async () => {
      await providers.google.signOut();
    },
  }));

  // Registered after the store is fully created so a provider that fires
  // synchronously can't race the initializer's own return value.
  providers.google.onAuthStateChanged((user) => {
    useAuthStore.setState({ user, status: user ? 'signedIn' : 'signedOut' });
  });

  return useAuthStore;
}
