import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type Timestamp,
} from '@react-native-firebase/firestore';

import type { CreditCard, CreditCardRepository } from '../types';

// Native only — see firestoreDebtRepository.native.ts (spec 008) for why
// this can't share the web-SDK-based (.web.ts) version.
function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
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
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback([]);
        return;
      }
      unsubscribeSnapshot = onSnapshot(collection(getFirestore(), `users/${user.uid}/creditCards`), (snapshot) => {
        callback(snapshot.docs.map((d) => toCard(d.id, d.data())));
      });
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(input) {
    const uid = requireUid();
    const ref = await addDoc(collection(getFirestore(), `users/${uid}/creditCards`), {
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
    const uid = requireUid();
    await updateDoc(doc(getFirestore(), `users/${uid}/creditCards/${id}`), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  async delete(id) {
    const uid = requireUid();
    await deleteDoc(doc(getFirestore(), `users/${uid}/creditCards/${id}`));
  },
};
