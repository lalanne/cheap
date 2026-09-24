import { create } from 'zustand';

import type {
  Category,
  CategoryRepository,
  CategoryType,
  NewTransactionInput,
  Transaction,
  TransactionRepository,
  UpdateTransactionInput,
} from './types';

type TransactionsState = {
  transactions: Transaction[];
  categories: Category[];
};

type TransactionsActions = {
  addTransaction: (input: NewTransactionInput) => Promise<void>;
  updateTransaction: (id: string, input: UpdateTransactionInput) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (name: string, type: CategoryType, parentCategory: string | null) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  // Spec 002's 2026-09-24 amendment — renames the category, and cascades
  // to every transaction that used oldName only when the name actually
  // changed (a parent-only edit needs no cascade).
  updateCategory: (id: string, name: string, parentCategory: string | null, oldName: string) => Promise<void>;
};

export type TransactionsStore = TransactionsState & TransactionsActions;

export type TransactionsRepositories = {
  transactions: TransactionRepository;
  categories: CategoryRepository;
};

function sortByDateDescending(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function createTransactionsStore(repos: TransactionsRepositories) {
  const useTransactionsStore = create<TransactionsStore>()(() => ({
    transactions: [],
    categories: [],

    addTransaction: async (input) => {
      await repos.transactions.create(input);
    },

    updateTransaction: async (id, input) => {
      await repos.transactions.update(id, input);
    },

    deleteTransaction: async (id) => {
      await repos.transactions.delete(id);
    },

    addCategory: async (name, type, parentCategory) => repos.categories.create(name, type, parentCategory),

    deleteCategory: async (id) => {
      await repos.categories.delete(id);
    },

    updateCategory: async (id, name, parentCategory, oldName) => {
      await repos.categories.update(id, name, parentCategory);
      if (name !== oldName) {
        await repos.transactions.renameCategoryInTransactions(oldName, name);
      }
    },
  }));

  // NOT called here, deliberately. Wiring up the repositories touches the
  // native Firebase Auth/Firestore bridge (getAuth/onAuthStateChanged/
  // getFirestore/onSnapshot on native) — doing that eagerly at module-load
  // time, before the app has ever rendered a frame, is suspected to be the
  // cause of a real TestFlight launch crash (uncaught NSException on
  // Expo's own error-recovery queue, first appearing in the build this
  // store first shipped with native Firestore support — see spec 002's
  // verification notes). startSync() is called explicitly by the caller
  // (App.tsx, inside a useEffect) instead, so it only ever runs after
  // first mount, and any native throw is caught here rather than left to
  // crash the whole app.
  function startSync(): () => void {
    let unsubscribeTransactions = () => {};
    let unsubscribeCategories = () => {};
    try {
      unsubscribeTransactions = repos.transactions.subscribe((transactions) => {
        useTransactionsStore.setState({ transactions: sortByDateDescending(transactions) });
      });
      unsubscribeCategories = repos.categories.subscribe((categories) => {
        useTransactionsStore.setState({ categories });
      });
    } catch (e) {
      console.warn('[transactionsStore] failed to start sync', e);
    }
    return () => {
      unsubscribeTransactions();
      unsubscribeCategories();
    };
  }

  return { useTransactionsStore, startSync };
}
