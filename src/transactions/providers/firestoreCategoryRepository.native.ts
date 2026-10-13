import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  updateDoc,
  type DocumentData,
} from '@react-native-firebase/firestore';

import type { Category, CategoryRepository } from '../types';

// Native only — see firestoreTransactionRepository.native.ts for why this
// can't share the web-SDK-based (plain filename) version.
function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access transactions.');
  }
  return uid;
}

function toCategory(id: string, data: DocumentData): Category {
  return { id, name: data.name, type: data.type, parentCategory: data.parentCategory ?? null };
}

export const firestoreCategoryRepository: CategoryRepository = {
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
        collection(getFirestore(), `users/${user.uid}/categories`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toCategory(d.id, d.data())));
        },
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(name, type, parentCategory) {
    const uid = requireUid();
    const ref = await addDoc(collection(getFirestore(), `users/${uid}/categories`), {
      name,
      type,
      parentCategory,
    });
    return { id: ref.id, name, type, parentCategory };
  },

  async delete(id) {
    const uid = requireUid();
    await deleteDoc(doc(getFirestore(), `users/${uid}/categories/${id}`));
  },

  async update(id, name, parentCategory) {
    const uid = requireUid();
    await updateDoc(doc(getFirestore(), `users/${uid}/categories/${id}`), { name, parentCategory });
  },
};
