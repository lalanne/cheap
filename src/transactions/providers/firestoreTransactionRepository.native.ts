import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from '@react-native-firebase/firestore';

import type { NewTransactionInput, Transaction, TransactionRepository } from '../types';

// Native only — @react-native-firebase/firestore, authenticated by the
// SAME native Auth session googleAuthProvider.native.ts /
// emailAuthProvider.native.ts sign into. The web-SDK-based
// firestoreTransactionRepository.ts (plain filename) is a *separate*,
// unauthenticated Firestore/Auth instance on native — using it there
// silently fails every write (confirmed: "Save" did nothing on a real
// device, because requireUid() found no user, matching this exact gap
// already flagged in spec 004's Verification results).
function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access transactions.');
  }
  return uid;
}

function toTransaction(id: string, data: DocumentData): Transaction {
  return {
    id,
    type: data.type,
    amount: data.amount,
    category: data.category,
    date: (data.date as Timestamp).toDate(),
    note: data.note ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export const firestoreTransactionRepository: TransactionRepository = {
  subscribe(callback) {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback([]);
        return;
      }
      const q = query(
        collection(getFirestore(), `users/${user.uid}/transactions`),
        orderBy('date', 'desc')
      );
      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map((d) => toTransaction(d.id, d.data())));
      });
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(input: NewTransactionInput) {
    const uid = requireUid();
    const ref = await addDoc(collection(getFirestore(), `users/${uid}/transactions`), {
      type: input.type,
      amount: input.amount,
      category: input.category,
      date: Timestamp.fromDate(input.date),
      note: input.note ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      type: input.type,
      amount: input.amount,
      category: input.category,
      date: input.date,
      note: input.note ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async update(id, input) {
    const uid = requireUid();
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.type !== undefined) data.type = input.type;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.category !== undefined) data.category = input.category;
    if (input.date !== undefined) data.date = Timestamp.fromDate(input.date);
    if (input.note !== undefined) data.note = input.note;
    await updateDoc(doc(getFirestore(), `users/${uid}/transactions/${id}`), data);
  },

  async delete(id) {
    const uid = requireUid();
    await deleteDoc(doc(getFirestore(), `users/${uid}/transactions/${id}`));
  },

  // Spec 002's 2026-09-24 amendment — the cascade a category rename
  // needs so it doesn't silently orphan every transaction using the
  // old name.
  async renameCategoryInTransactions(oldName, newName) {
    const uid = requireUid();
    const firestore = getFirestore();
    const matching = await getDocs(
      query(collection(firestore, `users/${uid}/transactions`), where('category', '==', oldName))
    );
    if (matching.empty) {
      return;
    }
    const batch = writeBatch(firestore);
    matching.docs.forEach((d) => {
      batch.update(d.ref, { category: newName, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },
};
