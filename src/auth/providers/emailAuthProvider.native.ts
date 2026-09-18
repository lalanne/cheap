import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from '@react-native-firebase/auth';

import type { EmailAuthProvider } from '../types';

// Required — Firebase's action-link emails (verify/reset) used to fall
// back to a Dynamic Link for the "continue" URL when none was given;
// Dynamic Links has since been shut down, and calling sendEmailVerification
// / sendPasswordResetEmail with no actionCodeSettings now throws inside the
// native SDK (a mangled "Cannot read property 'replace' of undefined" —
// nothing to do with our own code). da2's spec 001 hit this; same fix here.
// handleCodeInApp: false means Firebase's own hosted page handles the
// link, not a deep link back into this app.
const ACTION_CODE_SETTINGS = {
  url: 'https://lalanne-cheap-tracker.firebaseapp.com',
  handleCodeInApp: false,
};

function toAuthUser(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}) {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName,
    photoUrl: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

export const emailAuthProvider: EmailAuthProvider = {
  async signUp(name, email, password) {
    const { user } = await createUserWithEmailAndPassword(getAuth(), email, password);
    await updateProfile(user, { displayName: name });
    await sendEmailVerification(user, ACTION_CODE_SETTINGS);
    return toAuthUser({ ...user, displayName: name });
  },

  async signIn(email, password) {
    const { user } = await signInWithEmailAndPassword(getAuth(), email, password);
    return toAuthUser(user);
  },

  async sendPasswordReset(email) {
    await sendPasswordResetEmail(getAuth(), email, ACTION_CODE_SETTINGS);
  },

  async resendVerificationEmail() {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    await sendEmailVerification(user, ACTION_CODE_SETTINGS);
  },

  async reloadCurrentUser() {
    const user = getAuth().currentUser;
    if (!user) {
      return null;
    }
    await reload(user);
    // See googleAuthProvider.native.ts / emailAuthProvider.ts (web) — reload()
    // refreshes the profile but not the cached ID token's claims, so
    // Firestore's signedIn() check (reads request.auth.token.email_verified)
    // stays stuck denying until the token happens to rotate (~1h) without
    // this forced refresh.
    await getIdToken(getAuth().currentUser ?? user, true);
    return toAuthUser(getAuth().currentUser ?? user);
  },
};
