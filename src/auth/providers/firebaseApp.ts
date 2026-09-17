import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

// Sourced from EXPO_PUBLIC_* env vars (Expo's convention for client-exposed
// config) so no credentials are hardcoded. Unset until a real Firebase
// project exists for this app — see specs/001-auth.md.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// getAuth() throws synchronously (auth/invalid-api-key) when the config is
// missing, which would otherwise crash the whole app at import time before
// a real Firebase project exists. Degrade to `null` instead — the app then
// loads to the sign-in screen, and only errors when sign-in is attempted.
export let app: FirebaseApp | null;
export let auth: Auth | null;
try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch {
  app = null;
  auth = null;
}
