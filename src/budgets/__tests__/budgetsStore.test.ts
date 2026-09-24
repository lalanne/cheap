import { createBudgetsStore } from '../budgetsStore';
import type { Budget, BudgetRepository } from '../types';

function createMockRepo() {
  let budgets: Budget[] = [];
  let listener: ((b: Budget[]) => void) | null = null;
  let nextId = 1;

  const repo: BudgetRepository = {
    subscribe: jest.fn((callback) => {
      listener = callback;
      callback(budgets);
      return () => {
        listener = null;
      };
    }),
    create: jest.fn(async (category: string, monthlyLimit: number) => {
      const now = new Date();
      const budget: Budget = { id: `b-${nextId++}`, category, monthlyLimit, createdAt: now, updatedAt: now };
      budgets = [...budgets, budget];
      listener?.(budgets);
      return budget;
    }),
    update: jest.fn(async (id: string, monthlyLimit: number) => {
      budgets = budgets.map((b) => (b.id === id ? { ...b, monthlyLimit, updatedAt: new Date() } : b));
      listener?.(budgets);
    }),
    delete: jest.fn(async (id: string) => {
      budgets = budgets.filter((b) => b.id !== id);
      listener?.(budgets);
    }),
    renameCategoryInBudgets: jest.fn(async (oldName: string, newName: string) => {
      budgets = budgets.map((b) => (b.category === oldName ? { ...b, category: newName } : b));
      listener?.(budgets);
    }),
  };

  return repo;
}

function createStartedStore(repo: BudgetRepository) {
  const { useBudgetsStore, startSync } = createBudgetsStore(repo);
  startSync();
  return useBudgetsStore;
}

describe('budgetsStore', () => {
  it('does not touch the repository until startSync is called', () => {
    const repo = createMockRepo();
    createBudgetsStore(repo);

    expect(repo.subscribe).not.toHaveBeenCalled();
  });

  it('swallows a repository that throws when starting sync, instead of crashing', () => {
    const repo = createMockRepo();
    (repo.subscribe as jest.Mock).mockImplementation(() => {
      throw new Error('native bridge not ready');
    });

    const { startSync } = createBudgetsStore(repo);

    expect(() => startSync()).not.toThrow();
  });

  it('creates a new budget for a category with none yet (criterion 1)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);

    await useStore.getState().setBudget('Food', 250000);

    expect(repo.create).toHaveBeenCalledWith('Food', 250000);
    expect(repo.update).not.toHaveBeenCalled();
    expect(useStore.getState().budgets).toHaveLength(1);
    expect(useStore.getState().budgets[0]).toMatchObject({ category: 'Food', monthlyLimit: 250000 });
  });

  it('updates the existing budget in place for a category that already has one, not a duplicate (criterion 2)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);

    await useStore.getState().setBudget('Food', 250000);
    const id = useStore.getState().budgets[0].id;
    await useStore.getState().setBudget('Food', 300000);

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(id, 300000);
    expect(useStore.getState().budgets).toHaveLength(1);
    expect(useStore.getState().budgets[0].monthlyLimit).toBe(300000);
  });

  it('deletes a budget, leaving the category with no budget (criterion 5)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);
    await useStore.getState().setBudget('Food', 250000);
    const id = useStore.getState().budgets[0].id;

    await useStore.getState().deleteBudget(id);

    expect(useStore.getState().budgets).toHaveLength(0);
  });

  it('renames a category across the matching budget (spec 002 2026-09-24 amendment)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);
    await useStore.getState().setBudget('Uber Eats', 100000);

    await useStore.getState().renameCategoryInBudgets('Uber Eats', 'Food Delivery');

    expect(repo.renameCategoryInBudgets).toHaveBeenCalledWith('Uber Eats', 'Food Delivery');
    expect(useStore.getState().budgets[0].category).toBe('Food Delivery');
  });
});
