import type { AuthErrorLike } from './types';

const MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  // Newer Firebase Auth versions consolidate wrong-password/user-not-found
  // into one of these two codes instead (da2's spec 001 already hit this).
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/email-already-in-use':
    'An account with this email already exists — sign in or continue with Google instead.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'app/not-configured': "Sign-in isn't set up yet — check back soon.",
  // Not a Firebase code — our own sentinel for a dismissed native Google
  // picker. Never actually shown (the UI treats this as a silent no-op,
  // same as closing a popup on web), but mapped so it has a sane fallback.
  'auth/sign-in-cancelled': 'Sign-in was cancelled.',
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export function mapAuthError(error: AuthErrorLike): { code: string; message: string } {
  const code = error.code ?? 'unknown';
  return { code, message: MESSAGES[code] ?? GENERIC_MESSAGE };
}
