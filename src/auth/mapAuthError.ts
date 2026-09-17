import type { AuthErrorLike } from './types';

const MESSAGES: Record<string, string> = {
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'Incorrect email or password.',
  'auth/email-already-in-use':
    'An account with this email already exists — sign in or continue with Google instead.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'app/not-configured': "Sign-in isn't set up yet — check back soon.",
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export function mapAuthError(error: AuthErrorLike): { code: string; message: string } {
  const code = error.code ?? 'unknown';
  return { code, message: MESSAGES[code] ?? GENERIC_MESSAGE };
}
