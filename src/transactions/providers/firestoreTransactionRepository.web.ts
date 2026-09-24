import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import type { NewTransactionInput, Transaction, TransactionRepository } from '../types';
import { db, requireUid } from './firestoreDb';

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
  // Reacts to auth state rather than assuming a user already exists — this
  // subscribes at app start, before sign-in, so it must not throw the way
  // requireUid() deliberately does for create/update/delete.
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
      const q = query(collection(firestore, `users/${user.uid}/transactions`), orderBy('date', 'desc'));
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
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const ref = await addDoc(collection(db, `users/${uid}/transactions`), {
      type: input.type,
      amount: input.amount,
      category: input.category,
      date: Timestamp.fromDate(input.date),
      note: input.note ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // The listener delivers the server-resolved document; this optimistic
    // shape is returned only so callers awaiting create() get something.
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
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (input.type !== undefined) data.type = input.type;
    if (input.amount !== undefined) data.amount = input.amount;
    if (input.category !== undefined) data.category = input.category;
    if (input.date !== undefined) data.date = Timestamp.fromDate(input.date);
    if (input.note !== undefined) data.note = input.note;
    await updateDoc(doc(db, `users/${uid}/transactions/${id}`), data);
  },

  async delete(id) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await deleteDoc(doc(db, `users/${uid}/transactions/${id}`));
  },

  // Spec 002's 2026-09-24 amendment — the cascade a category rename
  // needs so it doesn't silently orphan every transaction using the
  // old name.
  async renameCategoryInTransactions(oldName, newName) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const matching = await getDocs(query(collection(db, `users/${uid}/transactions`), where('category', '==', oldName)));
    if (matching.empty) {
      return;
    }
    const batch = writeBatch(db);
    matching.docs.forEach((d) => {
      batch.update(d.ref, { category: newName, updatedAt: serverTimestamp() });
    });
    await batch.commit();
  },
};
