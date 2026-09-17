import {
  createUserWithEmailAndPassword,
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
    return toAuthUser(auth.currentUser);
  },
};
