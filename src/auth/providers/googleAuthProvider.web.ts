import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

import type { AuthProvider } from '../types';
import { auth } from './firebaseApp';
import { toAuthUser } from './toAuthUser';

// Web only — signInWithPopup needs a DOM window. Native (iOS/Android) needs
// its own implementation via @react-native-google-signin/google-signin +
// @react-native-firebase/auth (matching da2's pattern) — not built yet,
// since this project has no native dev client set up (see specs/001-auth.md).
export const googleAuthProvider: AuthProvider = {
  async signIn() {
    if (!auth) {
      throw { code: 'app/not-configured' };
    }
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    return toAuthUser(credential.user);
  },

  async signOut() {
    if (!auth) {
      return;
    }
    await signOut(auth);
  },

  onAuthStateChanged(callback) {
    if (!auth) {
      // No backend configured yet — treat as signed-out rather than
      // leaving the app stuck on the loading screen.
      callback(null);
      return () => {};
    }
    return onAuthStateChanged(auth, (user) => {
      callback(user ? toAuthUser(user) : null);
    });
  },
};
