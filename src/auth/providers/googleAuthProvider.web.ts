import { GoogleAuthProvider, onAuthStateChanged, signInWithRedirect, signOut } from 'firebase/auth';

import type { AuthProvider, AuthUser } from '../types';
import { auth } from './firebaseApp';
import { toAuthUser } from './toAuthUser';

// Web only. Native (iOS/Android) needs its own implementation via
// @react-native-google-signin/google-signin + @react-native-firebase/auth
// (matching da2's pattern) — see specs/001-auth.md.
export const googleAuthProvider: AuthProvider = {
  // signInWithRedirect, not signInWithPopup — a real deployed-web bug
  // (Safari): the popup flow let the app reach the signed-in screen, but
  // Firestore rejected every write/read with "Missing or insufficient
  // permissions" even though the account was genuinely verified server-
  // side. Safari's storage-partitioning restrictions on third-party popup
  // origins (accounts.google.com) are a documented cause of exactly this
  // — the popup's sign-in "succeeds" but the resulting credential/token
  // doesn't reliably carry over to the main app's Firestore connection.
  // signInWithRedirect avoids the popup entirely and is Firebase's own
  // documented recommendation for Safari compatibility.
  async signIn() {
    if (!auth) {
      throw { code: 'app/not-configured' };
    }
    await signInWithRedirect(auth, new GoogleAuthProvider());
    // Unreachable in practice — signInWithRedirect navigates the browser
    // away before this resolves. The actual sign-in completes via
    // onAuthStateChanged once the user is redirected back (same listener
    // authStore already relies on); authStore.signInWithGoogle only awaits
    // signIn() for its side effect / thrown errors and discards the
    // resolved value (see authStore.ts), so this placeholder is never read.
    return null as unknown as AuthUser;
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
