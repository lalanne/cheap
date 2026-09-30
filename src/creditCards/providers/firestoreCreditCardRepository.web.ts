import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import { db } from '../../transactions/providers/firestoreDb';
import type { CreditCard, CreditCardRepository } from '../types';

// Own requireUid, not the transactions module's — see
// firestoreBudgetRepository.web.ts for why.
function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access credit cards.');
  }
  return uid;
}

function toCard(id: string, data: DocumentData): CreditCard {
  return {
    id,
    name: data.name,
    limit: data.limit,
    minimumPayment: data.minimumPayment,
    monthlyRate: data.monthlyRate ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export const firestoreCreditCardRepository: CreditCardRepository = {
  subscribe(callback) {
    if (!db || !auth) {
      callback([]);
      return () => {};
    }
    const firestore = db;
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback([]);
        return;
      }
      unsubscribeSnapshot = onSnapshot(collection(firestore, `users/${user.uid}/creditCards`), (snapshot) => {
        callback(snapshot.docs.map((d) => toCard(d.id, d.data())));
      });
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(input) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const ref = await addDoc(collection(db, `users/${uid}/creditCards`), {
      name: input.name,
      limit: input.limit,
      minimumPayment: input.minimumPayment,
      monthlyRate: input.monthlyRate ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      name: input.name,
      limit: input.limit,
      minimumPayment: input.minimumPayment,
      monthlyRate: input.monthlyRate ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async update(id, patch) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await updateDoc(doc(db, `users/${uid}/creditCards/${id}`), { ...patch, updatedAt: serverTimestamp() });
  },

  async delete(id) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await deleteDoc(doc(db, `users/${uid}/creditCards/${id}`));
  },
};
