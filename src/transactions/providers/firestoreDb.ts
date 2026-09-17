import { getFirestore, type Firestore } from 'firebase/firestore';

import { app, auth } from '../../auth/providers/firebaseApp';

export const db: Firestore | null = app ? getFirestore(app) : null;

export function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access transactions.');
  }
  return uid;
}
