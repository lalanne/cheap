import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, type DocumentData } from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import type { Category, CategoryRepository } from '../types';
import { db, requireUid } from './firestoreDb';

function toCategory(id: string, data: DocumentData): Category {
  return { id, name: data.name, type: data.type };
}

export const firestoreCategoryRepository: CategoryRepository = {
  // See firestoreTransactionRepository.subscribe — same "no user yet" gap.
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
      unsubscribeSnapshot = onSnapshot(collection(firestore, `users/${user.uid}/categories`), (snapshot) => {
        callback(snapshot.docs.map((d) => toCategory(d.id, d.data())));
      });
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async create(name, type) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    const ref = await addDoc(collection(db, `users/${uid}/categories`), { name, type });
    return { id: ref.id, name, type };
  },

  async delete(id) {
    if (!db) {
      throw new Error('Firestore is not configured.');
    }
    const uid = requireUid();
    await deleteDoc(doc(db, `users/${uid}/categories/${id}`));
  },
};
