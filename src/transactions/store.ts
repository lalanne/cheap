import { createTransactionsStore } from './transactionsStore';
import { firestoreCategoryRepository } from './providers/firestoreCategoryRepository';
import { firestoreTransactionRepository } from './providers/firestoreTransactionRepository';

const { useTransactionsStore, startSync } = createTransactionsStore({
  transactions: firestoreTransactionRepository,
  categories: firestoreCategoryRepository,
});

export { useTransactionsStore };
// Called from App.tsx inside a useEffect, not here — see transactionsStore.ts.
export const startTransactionsSync = startSync;
