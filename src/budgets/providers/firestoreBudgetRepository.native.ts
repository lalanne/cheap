import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from '@react-native-firebase/firestore';

import type { Budget, BudgetRepository } from '../types';

// Native only — see firestoreTransactionRepository.native.ts (spec 002)
// for why this can't share the web-SDK-based (.web.ts) version: the web
// JS SDK is a separate, unauthenticated Firestore instance on native.
function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
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
        collection(getFirestore(), `users/${user.uid}/budgets`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toBudget(d.id, d.data())));
        },
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(category, monthlyLimit) {
    const uid = requireUid();
    const ref = await addDoc(collection(getFirestore(), `users/${uid}/budgets`), {
      category,
      monthlyLimit,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, category, monthlyLimit, createdAt: new Date(), updatedAt: new Date() };
  },

  async update(id, monthlyLimit) {
    const uid = requireUid();
    await updateDoc(doc(getFirestore(), `users/${uid}/budgets/${id}`), {
      monthlyLimit,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id) {
    const uid = requireUid();
    await deleteDoc(doc(getFirestore(), `users/${uid}/budgets/${id}`));
  },

  // Spec 002's 2026-09-24 amendment — same cascade as transactions; at
  // most one matching doc (spec 007: one budget per category).
  async renameCategoryInBudgets(oldName, newName) {
    const uid = requireUid();
    const firestore = getFirestore();
    const matching = await getDocs(
      query(collection(firestore, `users/${uid}/budgets`), where('category', '==', oldName)),
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
