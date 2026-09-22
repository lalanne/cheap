import { create } from 'zustand';

import type { Budget, BudgetRepository } from './types';

type BudgetsState = {
  budgets: Budget[];
};

type BudgetsActions = {
  setBudget: (category: string, monthlyLimit: number) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
};

export type BudgetsStore = BudgetsState & BudgetsActions;

export function createBudgetsStore(repo: BudgetRepository) {
  const useBudgetsStore = create<BudgetsStore>()((_set, get) => ({
    budgets: [],

    // One budget per category (spec 007 criterion 2) — looked up from
    // already-synced state, not a separate query, matching this app's
    // "no new Firestore queries for aggregation" convention.
    setBudget: async (category, monthlyLimit) => {
      const existing = get().budgets.find((b) => b.category === category);
      if (existing) {
        await repo.update(existing.id, monthlyLimit);
      } else {
        await repo.create(category, monthlyLimit);
      }
    },

    deleteBudget: async (id) => {
      await repo.delete(id);
    },
  }));

  // Deferred, not called here — same reasoning as transactionsStore.ts:
  // touching the native Firestore bridge at module-load time (before the
  // app has ever rendered a frame) is suspected to cause a real launch
  // crash. startSync() is called explicitly from App.tsx inside a
  // useEffect, and any native throw is caught here rather than left to
  // crash the whole app.
  function startSync(): () => void {
    let unsubscribe = () => {};
    try {
      unsubscribe = repo.subscribe((budgets) => {
        useBudgetsStore.setState({ budgets });
      });
    } catch (e) {
      console.warn('[budgetsStore] failed to start sync', e);
    }
    return () => {
      unsubscribe();
    };
  }

  return { useBudgetsStore, startSync };
}
