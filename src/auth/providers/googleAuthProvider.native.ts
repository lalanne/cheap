import { GoogleSignin, isCancelledResponse, isSuccessResponse } from '@react-native-google-signin/google-signin';
import {
  getAuth,
  GoogleAuthProvider as FirebaseGoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
} from '@react-native-firebase/auth';

import type { AuthProvider } from '../types';

// Web client ID (OAuth client type "Web application", auto-created by
// Firebase when Google sign-in was enabled) — required by
// @react-native-google-signin even on iOS-only so it can request an ID
// token Firebase Auth accepts. Not the iOS client ID from
// GoogleService-Info.plist; a separate credential. See specs/001-auth.md.
function getWebClientId(): string {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw { code: 'app/not-configured' };
  }
  return webClientId;
}

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

async function getGoogleIdToken(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (isCancelledResponse(response)) {
    throw { code: 'auth/sign-in-cancelled' };
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    throw { code: 'unknown' };
  }
  return response.data.idToken;
}

// Native only — @react-native-firebase/auth, a separate Auth instance from
// the web JS SDK's `firebase/auth`. emailAuthProvider.native.ts uses the
// same instance so there's one onAuthStateChanged on native, matching the
// web side's single-instance invariant (see specs/001-auth.md).
export const googleAuthProvider: AuthProvider = {
  async signIn() {
    GoogleSignin.configure({ webClientId: getWebClientId() });
    const idToken = await getGoogleIdToken();
    const credential = FirebaseGoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(getAuth(), credential);
    return toAuthUser(userCredential.user);
  },

  async signOut() {
    await signOut(getAuth());
    try {
      await GoogleSignin.signOut();
    } catch {
      // best-effort — Google session cleanup shouldn't block app sign-out
    }
  },

  onAuthStateChanged(callback) {
    return onAuthStateChanged(getAuth(), (user) => {
      callback(user ? toAuthUser(user) : null);
    });
  },
};
