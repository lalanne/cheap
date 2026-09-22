import { create } from 'zustand';

import type { Debt, DebtRepository, NewDebtInput } from './types';

type DebtsState = {
  debts: Debt[];
};

type DebtsActions = {
  addDebt: (input: NewDebtInput) => Promise<void>;
  logPayment: (id: string, amount: number) => Promise<void>;
  editBalance: (id: string, currentBalance: number) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
};

export type DebtsStore = DebtsState & DebtsActions;

export function createDebtsStore(repo: DebtRepository) {
  const useDebtsStore = create<DebtsStore>()(() => ({
    debts: [],

    addDebt: async (input) => {
      await repo.create(input);
    },

    // Atomicity (transaction + balance, together or not at all — spec 008
    // criterion 2) lives in the repository, not here: the store just
    // delegates and lets a rejection propagate rather than swallowing it.
    logPayment: async (id, amount) => {
      await repo.logPayment(id, amount);
    },

    // Deliberately separate from logPayment — no transaction created
    // (criterion 3).
    editBalance: async (id, currentBalance) => {
      await repo.updateBalance(id, currentBalance);
    },

    deleteDebt: async (id) => {
      await repo.delete(id);
    },
  }));

  // Deferred, not called here — same reasoning as budgetsStore.ts /
  // transactionsStore.ts: touching the native Firestore bridge at
  // module-load time is suspected to cause a real launch crash.
  function startSync(): () => void {
    let unsubscribe = () => {};
    try {
      unsubscribe = repo.subscribe((debts) => {
        useDebtsStore.setState({ debts });
      });
    } catch (e) {
      console.warn('[debtsStore] failed to start sync', e);
    }
    return () => {
      unsubscribe();
    };
  }

  return { useDebtsStore, startSync };
}
