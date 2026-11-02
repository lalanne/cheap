import { create } from 'zustand';

import { STARTER_CATEGORIES } from '../transactions/starterCategories';
import type { Category, CategoryRepository } from '../transactions/types';
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

export const DEBT_PARENT_CATEGORY = 'Debt';

function nameTaken(name: string, categories: Category[]): boolean {
  return STARTER_CATEGORIES.includes(name) || categories.some((c) => c.name === name);
}

// `categoryRepo` is optional so the store stays usable on its own (and its
// older tests unchanged); in the app it is always passed (store.ts).
export function createDebtsStore(
  repo: DebtRepository,
  categoryRepo?: Pick<CategoryRepository, 'subscribe' | 'create'>,
) {
  let categories: Category[] = [];
  // Backfill must wait for the first category snapshot, or it would treat
  // every existing subcategory as missing.
  let categoriesLoaded = false;
  // Names whose subcategory is being created right now — stops two syncs
  // firing close together from creating the same subcategory twice.
  const creating = new Set<string>();

  function ensureSubcategory(name: string): Promise<void> {
    if (!categoryRepo || creating.has(name)) {
      return Promise.resolve();
    }
    creating.add(name);
    return categoryRepo
      .create(name, 'expense', DEBT_PARENT_CATEGORY)
      .then(() => undefined)
      .finally(() => creating.delete(name));
  }

  // Spec 008 criterion 12 — a debt gets its subcategory once; one whose
  // name already belongs to another category is skipped (stays its own slice).
  function backfill(debts: Debt[]) {
    if (!categoriesLoaded) {
      return;
    }
    for (const debt of debts) {
      if (!nameTaken(debt.name, categories)) {
        ensureSubcategory(debt.name).catch((e) =>
          console.warn('[debtsStore] failed to create debt subcategory', e),
        );
      }
    }
  }

  const useDebtsStore = create<DebtsStore>()(() => ({
    debts: [],

    // Criteria 10 and 13 — reject a name that another category already
    // uses; otherwise create the debt and its "Debt" subcategory.
    addDebt: async (input) => {
      if (categoryRepo && nameTaken(input.name, categories)) {
        throw new Error('A category with this name already exists.');
      }
      await repo.create(input);
      await ensureSubcategory(input.name);
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
    let unsubscribeCategories = () => {};
    try {
      unsubscribe = repo.subscribe((debts) => {
        useDebtsStore.setState({ debts });
        backfill(debts);
      });
      if (categoryRepo) {
        unsubscribeCategories = categoryRepo.subscribe((next) => {
          categories = next;
          categoriesLoaded = true;
          backfill(useDebtsStore.getState().debts);
        });
      }
    } catch (e) {
      console.warn('[debtsStore] failed to start sync', e);
    }
    return () => {
      unsubscribe();
      unsubscribeCategories();
    };
  }

  return { useDebtsStore, startSync };
}
