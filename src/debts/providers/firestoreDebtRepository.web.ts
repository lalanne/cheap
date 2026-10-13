import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import type { Debt, DebtRepository, NewDebtInput } from '../types';
import { db } from '../../transactions/providers/firestoreDb';

// Own requireUid, not the transactions module's — see
// firestoreBudgetRepository.web.ts for why.
function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access debts.');
  }
  return uid;
}

function toDebt(id: string, data: DocumentData): Debt {
  return {
    id,
    name: data.name,
    originalAmount: data.originalAmount,
    currentBalance: data.currentBalance,
    minimumPayment: data.minimumPayment,
    interestRate: data.interestRate ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

export const firestoreDebtRepository: DebtRepository = {
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
        collection(firestore, `users/${user.uid}/debts`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toDebt(d.id, d.data())));
        },
      );
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
    const ref = await addDoc(collection(db, `users/${uid}/debts`), {
      name: input.name,
      originalAmount: input.originalAmount,
      currentBalance: input.currentBalance,
      minimumPayment: input.minimumPayment,
      interestRate: input.interestRate ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      name: input.name,
      originalAmount: input.originalAmount,
      currentBalance: input.currentBalance,
      minimumPayment: input.minimumPayment,
      interestRate: input.interestRate ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  async updateBalance(id, currentBalance) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await updateDoc(doc(db, `users/${uid}/debts/${id}`), {
      currentBalance,
      updatedAt: serverTimestamp(),
    });
  },

  // See firestoreDebtRepository.native.ts — the one atomic cross-collection
  // write in this app (spec 008, criterion 2).
  async logPayment(id, amount) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const debtRef = doc(db, `users/${uid}/debts/${id}`);
    const transactionRef = doc(collection(db, `users/${uid}/transactions`));

    await runTransaction(db, async (t) => {
      const debtSnap = await t.get(debtRef);
      const debtData = debtSnap.data();
      if (!debtData) {
        throw new Error('Debt not found.');
      }
      const newBalance = (debtData.currentBalance as number) - amount;

      t.set(transactionRef, {
        type: 'expense',
        amount,
        category: debtData.name,
        date: Timestamp.fromDate(new Date()),
        note: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      t.update(debtRef, { currentBalance: newBalance, updatedAt: serverTimestamp() });
    });
  },

  async delete(id) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await deleteDoc(doc(db, `users/${uid}/debts/${id}`));
  },
};
