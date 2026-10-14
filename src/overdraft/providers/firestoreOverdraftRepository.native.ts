import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  type DocumentData,
} from '@react-native-firebase/firestore';

import {
  OVERDRAFT_CHARGES_CATEGORY,
  type OverdraftEvent,
  type OverdraftEventType,
  type OverdraftLine,
  type OverdraftRepository,
} from '../types';

// Native only — see firestoreTransactionRepository.native.ts (spec 002)
// for why this can't share the web-SDK-based (.web.ts) version.
function requireUid(): string {
  const uid = getAuth().currentUser?.uid;
  if (!uid) {
    throw new Error('No signed-in user — cannot access the overdraft line.');
  }
  return uid;
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

export const firestoreOverdraftRepository: OverdraftRepository = {
  subscribeLine(callback) {
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback(null);
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        doc(getFirestore(), `users/${user.uid}/overdraft/line`),
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
    let unsubscribeSnapshot: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(getAuth(), (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = null;
      if (!user) {
        callback([]);
        return;
      }
      unsubscribeSnapshot = onSnapshot(
        collection(getFirestore(), `users/${user.uid}/overdraftEvents`),
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

  // The line doc and its optional "Opening balance" draw are one transaction,
  // so a half-set-up line (settings but no opening debt) can't be left behind.
  async saveLine(input) {
    const uid = requireUid();
    const db = getFirestore();
    const lineRef = doc(db, `users/${uid}/overdraft/line`);
    const openingRef = input.openingBalance
      ? doc(collection(db, `users/${uid}/overdraftEvents`))
      : null;

    await runTransaction(db, async (t) => {
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
    const uid = requireUid();
    await updateDoc(doc(getFirestore(), `users/${uid}/overdraft/line`), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  // Draws and principal payments are one event, no transaction: neither is
  // income or spending (spec 012, "Money rules").
  async logDraw(input) {
    const uid = requireUid();
    await addDoc(
      collection(getFirestore(), `users/${uid}/overdraftEvents`),
      eventData('draw', input.amount, input.date, input.note ?? null, null),
    );
  },

  async logPayment(input) {
    const uid = requireUid();
    await addDoc(
      collection(getFirestore(), `users/${uid}/overdraftEvents`),
      eventData('payment', input.amount, input.date, input.note ?? null, null),
    );
  },

  // Interest and fees are real spending: the event and its linked expense
  // are staged in one Firestore transaction — together or not at all
  // (spec 012 criterion 6).
  async logCharge(type, input) {
    const uid = requireUid();
    const db = getFirestore();
    const transactionRef = doc(collection(db, `users/${uid}/transactions`));
    const eventRef = doc(collection(db, `users/${uid}/overdraftEvents`));
    const note = input.note ?? null;

    await runTransaction(db, async (t) => {
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

  // A charge takes its linked expense with it, in the same transaction.
  async deleteEvent(id) {
    const uid = requireUid();
    const db = getFirestore();
    const eventRef = doc(db, `users/${uid}/overdraftEvents/${id}`);

    await runTransaction(db, async (t) => {
      const snap = await t.get(eventRef);
      const data = snap.data();
      if (!data) {
        throw new Error('Event not found.');
      }
      if (data.transactionId) {
        t.delete(doc(db, `users/${uid}/transactions/${data.transactionId}`));
      }
      t.delete(eventRef);
    });
  },
};
