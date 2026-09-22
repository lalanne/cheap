import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import type { Budget, BudgetRepository } from '../types';
import { db } from '../../transactions/providers/firestoreDb';

// Own requireUid, not the transactions module's — that one's error text is
// transaction-specific ("cannot access transactions"), which would be
// misleading here. `db` itself is a legitimate shared singleton.
function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access budgets.');
  }
  return uid;
}

function toBudget(id: string, data: DocumentData): Budget {
  return {
    id,
    category: data.category,
    monthlyLimit: data.monthlyLimit,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export const firestoreBudgetRepository: BudgetRepository = {
  // Reacts to auth state rather than assuming a user already exists —
  // matches firestoreTransactionRepository.web.ts's subscribe (spec 002).
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
        collection(firestore, `users/${user.uid}/budgets`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toBudget(d.id, d.data())));
        }
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(category, monthlyLimit) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const ref = await addDoc(collection(db, `users/${uid}/budgets`), {
      category,
      monthlyLimit,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, category, monthlyLimit, createdAt: new Date(), updatedAt: new Date() };
  },

  async update(id, monthlyLimit) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await updateDoc(doc(db, `users/${uid}/budgets/${id}`), {
      monthlyLimit,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await deleteDoc(doc(db, `users/${uid}/budgets/${id}`));
  },
};
