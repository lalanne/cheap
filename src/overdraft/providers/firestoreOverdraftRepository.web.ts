import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';

import { auth } from '../../auth/providers/firebaseApp';
import { db } from '../../transactions/providers/firestoreDb';
import {
  OVERDRAFT_CHARGES_CATEGORY,
  type OverdraftEvent,
  type OverdraftEventType,
  type OverdraftLine,
  type OverdraftRepository,
} from '../types';

// Own requireUid, not the transactions module's — see
// firestoreBudgetRepository.web.ts for why.
function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access the overdraft line.');
  }
  return uid;
}

function requireDb() {
  if (!db) {
    throw new Error('Firestore is not configured.');
  }
  return db;
}

function toLine(data: DocumentData): OverdraftLine {
  return {
    limit: data.limit,
    monthlyRate: data.monthlyRate ?? null,
    plannedMonthlyPayment: data.plannedMonthlyPayment ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate() ?? new Date(),
  };
}

function toEvent(id: string, data: DocumentData): OverdraftEvent {
  return {
    id,
    type: data.type,
    amount: data.amount,
    date: (data.date as Timestamp)?.toDate() ?? new Date(),
    note: data.note ?? null,
    transactionId: data.transactionId ?? null,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
  };
}

function eventData(
  type: OverdraftEventType,
  amount: number,
  date: Date,
  note: string | null,
  transactionId: string | null,
) {
  return {
    type,
    amount,
    date: Timestamp.fromDate(date),
    note,
    transactionId,
    createdAt: serverTimestamp(),
  };
}

// See firestoreOverdraftRepository.native.ts for the reasoning behind each
// write; this mirrors it on the web SDK.
export const firestoreOverdraftRepository: OverdraftRepository = {
  subscribeLine(callback) {
    if (!db || !auth) {
      callback(null);
      return () => {};
    }
    const firestore = db;
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback(null);
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        doc(firestore, `users/${user.uid}/overdraft/line`),
        (snapshot) => {
          const data = snapshot.data();
          callback(data ? toLine(data) : null);
        },
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  subscribeEvents(callback) {
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
        collection(firestore, `users/${user.uid}/overdraftEvents`),
        (snapshot) => {
          callback(snapshot.docs.map((d) => toEvent(d.id, d.data())));
        },
      );
    });
    return () => {
      unsubscribeSnapshot?.();
      unsubscribeAuth();
    };
  },

  async saveLine(input) {
    const firestore = requireDb();
    const uid = requireUid();
    const lineRef = doc(firestore, `users/${uid}/overdraft/line`);
    const openingRef = input.openingBalance
      ? doc(collection(firestore, `users/${uid}/overdraftEvents`))
      : null;

    await runTransaction(firestore, async (t) => {
      t.set(lineRef, {
        limit: input.limit,
        monthlyRate: input.monthlyRate ?? null,
        plannedMonthlyPayment: input.plannedMonthlyPayment ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (openingRef && input.openingBalance) {
        t.set(
          openingRef,
          eventData(
            'draw',
            input.openingBalance,
            input.openingDate ?? new Date(),
            'Opening balance',
            null,
          ),
        );
      }
    });
  },

  async updateLine(patch) {
    const firestore = requireDb();
    const uid = requireUid();
    await updateDoc(doc(firestore, `users/${uid}/overdraft/line`), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  async logDraw(input) {
    const firestore = requireDb();
    const uid = requireUid();
    await addDoc(
      collection(firestore, `users/${uid}/overdraftEvents`),
      eventData('draw', input.amount, input.date, input.note ?? null, null),
    );
  },

  async logPayment(input) {
    const firestore = requireDb();
    const uid = requireUid();
    await addDoc(
      collection(firestore, `users/${uid}/overdraftEvents`),
      eventData('payment', input.amount, input.date, input.note ?? null, null),
    );
  },

  async logCharge(type, input) {
    const firestore = requireDb();
    const uid = requireUid();
    const transactionRef = doc(collection(firestore, `users/${uid}/transactions`));
    const eventRef = doc(collection(firestore, `users/${uid}/overdraftEvents`));
    const note = input.note ?? null;

    await runTransaction(firestore, async (t) => {
      t.set(transactionRef, {
        type: 'expense',
        amount: input.amount,
        category: OVERDRAFT_CHARGES_CATEGORY,
        date: Timestamp.fromDate(input.date),
        note,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      t.set(eventRef, eventData(type, input.amount, input.date, note, transactionRef.id));
    });
  },

  async deleteEvent(id) {
    const firestore = requireDb();
    const uid = requireUid();
    const eventRef = doc(firestore, `users/${uid}/overdraftEvents/${id}`);

    await runTransaction(firestore, async (t) => {
      const snap = await t.get(eventRef);
      const data = snap.data();
      if (!data) {
        throw new Error('Event not found.');
      }
      if (data.transactionId) {
        t.delete(doc(firestore, `users/${uid}/transactions/${data.transactionId}`));
      }
      t.delete(eventRef);
    });
  },
};
