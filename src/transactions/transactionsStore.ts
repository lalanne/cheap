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
  addCategory: (name: string, type: CategoryType) => Promise<Category>;
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

    addCategory: async (name, type) => repos.categories.create(name, type),
  }));

  // Registered after the store is fully created — see authStore.ts for why
  // a synchronous listener callback during the initializer would be lost.
  repos.transactions.subscribe((transactions) => {
    useTransactionsStore.setState({ transactions: sortByDateDescending(transactions) });
  });
  repos.categories.subscribe((categories) => {
    useTransactionsStore.setState({ categories });
  });

  return useTransactionsStore;
}
