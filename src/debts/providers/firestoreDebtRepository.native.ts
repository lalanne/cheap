import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from '@react-native-firebase/firestore';

import type { Debt, DebtRepository, NewDebtInput } from '../types';

// Native only — see firestoreTransactionRepository.native.ts (spec 002)
// for why this can't share the web-SDK-based (.web.ts) version.
function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
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
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback([]);
        return;
      }
      unsubscribeSnapshot = onSnapshot(collection(getFirestore(), `users/${user.uid}/debts`), (snapshot) => {
        callback(snapshot.docs.map((d) => toDebt(d.id, d.data())));
      });
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(input) {
    const uid = requireUid();
    const ref = await addDoc(collection(getFirestore(), `users/${uid}/debts`), {
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
    const uid = requireUid();
    await updateDoc(doc(getFirestore(), `users/${uid}/debts/${id}`), {
      currentBalance,
      updatedAt: serverTimestamp(),
    });
  },

  // The one atomic cross-collection write in this app (spec 008,
  // criterion 2): a new expense transaction in the debt's own category,
  // and the debt's balance decreasing by the same amount, together or
  // not at all. Reads the current balance from *inside* the transaction
  // (not from cached state) so two concurrent payments can't race.
  async logPayment(id, amount) {
    const uid = requireUid();
    const debtRef = doc(getFirestore(), `users/${uid}/debts/${id}`);
    const transactionRef = doc(collection(getFirestore(), `users/${uid}/transactions`));

    await runTransaction(getFirestore(), async (t) => {
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
    const uid = requireUid();
    await deleteDoc(doc(getFirestore(), `users/${uid}/debts/${id}`));
  },
};
