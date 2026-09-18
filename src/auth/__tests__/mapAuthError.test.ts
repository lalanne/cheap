import { mapAuthError } from '../mapAuthError';

describe('mapAuthError', () => {
  it('collapses wrong-password and user-not-found to the same generic message (criterion 6)', () => {
    const wrongPassword = mapAuthError({ code: 'auth/wrong-password' });
    const userNotFound = mapAuthError({ code: 'auth/user-not-found' });

    expect(wrongPassword.message).toBe('Incorrect email or password.');
    expect(userNotFound.message).toBe('Incorrect email or password.');
  });

  it('gives email-already-in-use its own specific message (criterion 8)', () => {
    const mapped = mapAuthError({ code: 'auth/email-already-in-use' });

    expect(mapped.message).toBe(
      'An account with this email already exists — sign in or continue with Google instead.'
    );
  });

  it('collapses the newer consolidated invalid-credential codes the same way (da2 finding)', () => {
    expect(mapAuthError({ code: 'auth/invalid-credential' }).message).toBe(
      'Incorrect email or password.'
    );
    expect(mapAuthError({ code: 'auth/invalid-login-credentials' }).message).toBe(
      'Incorrect email or password.'
    );
  });

  it('maps weak-password, invalid-email, and too-many-requests', () => {
    expect(mapAuthError({ code: 'auth/weak-password' }).message).toBe(
      'Password must be at least 8 characters.'
    );
    expect(mapAuthError({ code: 'auth/invalid-email' }).message).toBe(
      'Enter a valid email address.'
    );
    expect(mapAuthError({ code: 'auth/too-many-requests' }).message).toBe(
      'Too many attempts. Try again later.'
    );
  });

  it('falls back to a generic message for an unrecognized or missing code', () => {
    expect(mapAuthError({ code: 'auth/network-request-failed' }).message).toBe(
      'Something went wrong. Please try again.'
    );
    expect(mapAuthError({}).message).toBe('Something went wrong. Please try again.');
  });

  it('maps the not-configured sentinel used when no Firebase project is wired up yet', () => {
    expect(mapAuthError({ code: 'app/not-configured' }).message).toBe(
      "Sign-in isn't set up yet — check back soon."
    );
  });

  it('preserves the original error code', () => {
    expect(mapAuthError({ code: 'auth/user-not-found' }).code).toBe('auth/user-not-found');
  });
});
