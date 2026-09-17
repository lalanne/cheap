import { createTransactionsStore } from './transactionsStore';
import { firestoreCategoryRepository } from './providers/firestoreCategoryRepository';
import { firestoreTransactionRepository } from './providers/firestoreTransactionRepository';

export const useTransactionsStore = createTransactionsStore({
  transactions: firestoreTransactionRepository,
  categories: firestoreCategoryRepository,
});
