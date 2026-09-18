import {
  createUserWithEmailAndPassword,
  getIdToken,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';

import type { EmailAuthProvider } from '../types';
import { auth } from './firebaseApp';
import { toAuthUser } from './toAuthUser';

export const emailAuthProvider: EmailAuthProvider = {
  async signUp(name, email, password) {
    if (!auth) {
      throw { code: 'app/not-configured' };
    }
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await sendEmailVerification(credential.user);
    return toAuthUser(credential.user);
  },

  async signIn(email, password) {
    if (!auth) {
      throw { code: 'app/not-configured' };
    }
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return toAuthUser(credential.user);
  },

  async sendPasswordReset(email) {
    if (!auth) {
      throw { code: 'app/not-configured' };
    }
    await sendPasswordResetEmail(auth, email);
  },

  async resendVerificationEmail() {
    if (auth?.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  },

  async reloadCurrentUser() {
    if (!auth?.currentUser) {
      return null;
    }
    await auth.currentUser.reload();
    // reload() refreshes the local user *profile* (this is what flips
    // emailVerified to true) but NOT the cached ID token — Firestore rules
    // read request.auth.token.email_verified, a claim baked into that
    // token when it was minted (still `false`, from before verification).
    // Without forcing a fresh token here, every Firestore request keeps
    // failing signedIn() until the SDK happens to rotate the token on its
    // own (up to ~1h) — looks like a permanently stuck loading spinner.
    // (Found via da2's spec 001 — the same bug, same fix, same SDK family.)
    await getIdToken(auth.currentUser, true);
    return toAuthUser(auth.currentUser);
  },
};
