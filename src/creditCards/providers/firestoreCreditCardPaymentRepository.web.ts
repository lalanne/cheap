import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import { db } from '../../transactions/providers/firestoreDb';
import type { CreditCardPayment, CreditCardPaymentRepository } from '../types';

function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access credit card payments.');
  }
  return uid;
}

function toPayment(id: string, data: DocumentData): CreditCardPayment {
  return {
    id,
    cardId: data.cardId,
    amount: data.amount,
    date: (data.date as Timestamp)?.toDate() ?? new Date(),
    note: data.note ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export const firestoreCreditCardPaymentRepository: CreditCardPaymentRepository = {
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
      unsubscribeSnapshot = onSnapshot(
        collection(firestore, `users/${user.uid}/creditCardPayments`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toPayment(d.id, d.data())));
        },
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async logPayment(input) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await addDoc(collection(db, `users/${uid}/creditCardPayments`), {
      cardId: input.cardId,
      amount: input.amount,
      date: Timestamp.fromDate(input.date),
      note: input.note ?? null,
      createdAt: serverTimestamp(),
    });
  },

  async deletePayment(id) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await deleteDoc(doc(db, `users/${uid}/creditCardPayments/${id}`));
  },
};
