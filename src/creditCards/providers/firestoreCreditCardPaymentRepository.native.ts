import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
} from '@react-native-firebase/firestore';

import type { CreditCardPayment, CreditCardPaymentRepository } from '../types';

function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
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

// A payment is not an expense: it creates no transaction, just this one
// small record (spec 013 criterion 5) — paying off purchases already
// logged would double-count them.
export const firestoreCreditCardPaymentRepository: CreditCardPaymentRepository = {
  subscribe(callback) {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback([]);
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        collection(getFirestore(), `users/${user.uid}/creditCardPayments`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toPayment(d.id, d.data())));
        }
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async logPayment(input) {
    const uid = requireUid();
    await addDoc(collection(getFirestore(), `users/${uid}/creditCardPayments`), {
      cardId: input.cardId,
      amount: input.amount,
      date: Timestamp.fromDate(input.date),
      note: input.note ?? null,
      createdAt: serverTimestamp(),
    });
  },

  async deletePayment(id) {
    const uid = requireUid();
    await deleteDoc(doc(getFirestore(), `users/${uid}/creditCardPayments/${id}`));
  },
};
