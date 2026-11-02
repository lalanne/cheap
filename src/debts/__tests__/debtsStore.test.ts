import { createDebtsStore } from '../debtsStore';
import type { Category, CategoryRepository } from '../../transactions/types';
import type { Debt, DebtRepository, NewDebtInput } from '../types';

function createMockRepo() {
  let debts: Debt[] = [];
  let listener: ((d: Debt[]) => void) | null = null;
  let nextId = 1;

  const repo: DebtRepository = {
    subscribe: jest.fn((callback) => {
      listener = callback;
      callback(debts);
      return () => {
        listener = null;
      };
    }),
    create: jest.fn(async (input: NewDebtInput) => {
      const now = new Date();
      const debt: Debt = {
        id: `d-${nextId++}`,
        name: input.name,
        originalAmount: input.originalAmount,
        currentBalance: input.currentBalance,
        minimumPayment: input.minimumPayment,
        interestRate: input.interestRate ?? null,
        createdAt: now,
        updatedAt: now,
      };
      debts = [...debts, debt];
      listener?.(debts);
      return debt;
    }),
    updateBalance: jest.fn(async (id: string, currentBalance: number) => {
      debts = debts.map((d) => (d.id === id ? { ...d, currentBalance, updatedAt: new Date() } : d));
      listener?.(debts);
    }),
    logPayment: jest.fn(async (id: string, amount: number) => {
      debts = debts.map((d) =>
        d.id === id
          ? { ...d, currentBalance: d.currentBalance - amount, updatedAt: new Date() }
          : d,
      );
      listener?.(debts);
    }),
    delete: jest.fn(async (id: string) => {
      debts = debts.filter((d) => d.id !== id);
      listener?.(debts);
    }),
  };

  return repo;
}

function createStartedStore(repo: DebtRepository) {
  const { useDebtsStore, startSync } = createDebtsStore(repo);
  startSync();
  return useDebtsStore;
}

const NEW_DEBT: NewDebtInput = {
  name: 'Credit Card',
  originalAmount: 2000000,
  currentBalance: 2000000,
  minimumPayment: 100000,
  interestRate: null,
};

describe('debtsStore', () => {
  it('does not touch the repository until startSync is called', () => {
    const repo = createMockRepo();
    createDebtsStore(repo);

    expect(repo.subscribe).not.toHaveBeenCalled();
  });

  it('swallows a repository that throws when starting sync, instead of crashing', () => {
    const repo = createMockRepo();
    (repo.subscribe as jest.Mock).mockImplementation(() => {
      throw new Error('native bridge not ready');
    });

    const { startSync } = createDebtsStore(repo);

    expect(() => startSync()).not.toThrow();
  });

  it('creates a debt (criterion 1)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);

    await useStore.getState().addDebt(NEW_DEBT);

    expect(repo.create).toHaveBeenCalledWith(NEW_DEBT);
    expect(useStore.getState().debts).toHaveLength(1);
    expect(useStore.getState().debts[0]).toMatchObject({
      name: 'Credit Card',
      currentBalance: 2000000,
    });
  });

  it('logs a payment via the repository (criterion 2 — atomicity lives in the repo)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);
    await useStore.getState().addDebt(NEW_DEBT);
    const id = useStore.getState().debts[0].id;

    await useStore.getState().logPayment(id, 50000);

    expect(repo.logPayment).toHaveBeenCalledWith(id, 50000);
    expect(useStore.getState().debts[0].currentBalance).toBe(1950000);
  });

  it('propagates a logPayment rejection instead of silently swallowing it', async () => {
    const repo = createMockRepo();
    (repo.logPayment as jest.Mock).mockRejectedValueOnce(new Error('atomic write failed'));
    const useStore = createStartedStore(repo);
    await useStore.getState().addDebt(NEW_DEBT);
    const id = useStore.getState().debts[0].id;

    await expect(useStore.getState().logPayment(id, 50000)).rejects.toThrow('atomic write failed');
  });

  it('edits the balance directly without logging a payment (criterion 3)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);
    await useStore.getState().addDebt(NEW_DEBT);
    const id = useStore.getState().debts[0].id;

    await useStore.getState().editBalance(id, 1800000);

    expect(repo.updateBalance).toHaveBeenCalledWith(id, 1800000);
    expect(repo.logPayment).not.toHaveBeenCalled();
    expect(useStore.getState().debts[0].currentBalance).toBe(1800000);
  });

  it('keeps a paid-off debt in state until explicitly deleted (criterion 6)', async () => {
    const repo = createMockRepo();
    const useStore = createStartedStore(repo);
    await useStore.getState().addDebt(NEW_DEBT);
    const id = useStore.getState().debts[0].id;

    await useStore.getState().editBalance(id, 0);
    expect(useStore.getState().debts).toHaveLength(1);
    expect(useStore.getState().debts[0].currentBalance).toBe(0);

    await useStore.getState().deleteDebt(id);
    expect(useStore.getState().debts).toHaveLength(0);
  });

  // Spec 008 criteria 10, 12, 13 — issue #74: every debt gets a subcategory
  // under the built-in "Debt" category.
  describe('Debt category (issue #74)', () => {
    function createMockCategoryRepo(initial: Category[] = []) {
      let categories = initial;
      let listener: ((c: Category[]) => void) | null = null;
      const repo: CategoryRepository = {
        subscribe: jest.fn((callback) => {
          listener = callback;
          callback(categories);
          return () => {
            listener = null;
          };
        }),
        create: jest.fn(async (name, type, parentCategory) => {
          const category: Category = {
            id: `c-${categories.length + 1}`,
            name,
            type,
            parentCategory,
          };
          categories = [...categories, category];
          listener?.(categories);
          return category;
        }),
        delete: jest.fn(),
        update: jest.fn(),
      };
      return repo;
    }

    function startWithCategories(repo: DebtRepository, categoryRepo: CategoryRepository) {
      const { useDebtsStore, startSync } = createDebtsStore(repo, categoryRepo);
      startSync();
      return useDebtsStore;
    }

    const flush = () => new Promise((resolve) => setImmediate(resolve));

    it('creates a "Debt" expense subcategory named after a new debt (criterion 10)', async () => {
      const categoryRepo = createMockCategoryRepo();
      const useStore = startWithCategories(createMockRepo(), categoryRepo);

      await useStore.getState().addDebt(NEW_DEBT);

      expect(categoryRepo.create).toHaveBeenCalledWith('Credit Card', 'expense', 'Debt');
    });

    it('rejects a debt whose name equals an existing category, creating nothing (criterion 13)', async () => {
      const repo = createMockRepo();
      const categoryRepo = createMockCategoryRepo([
        { id: 'c-0', name: 'Credit Card', type: 'expense', parentCategory: null },
      ]);
      const useStore = startWithCategories(repo, categoryRepo);

      await expect(useStore.getState().addDebt(NEW_DEBT)).rejects.toThrow(/already/i);
      await expect(useStore.getState().addDebt({ ...NEW_DEBT, name: 'Food' })).rejects.toThrow(
        /already/i,
      );

      expect(repo.create).not.toHaveBeenCalled();
      expect(categoryRepo.create).not.toHaveBeenCalled();
    });

    it('backfills missing subcategories once for existing debts (criterion 12)', async () => {
      const repo = createMockRepo();
      const categoryRepo = createMockCategoryRepo();
      const useStore = createDebtsStore(repo); // seed debts without categories
      useStore.startSync();
      await useStore.useDebtsStore.getState().addDebt(NEW_DEBT);
      await useStore.useDebtsStore.getState().addDebt({ ...NEW_DEBT, name: 'papa 1' });

      startWithCategories(repo, categoryRepo);
      await flush();
      await flush();

      expect(categoryRepo.create).toHaveBeenCalledTimes(2);
      expect(categoryRepo.create).toHaveBeenCalledWith('papa 1', 'expense', 'Debt');

      startWithCategories(repo, categoryRepo); // sync again — idempotent
      await flush();
      expect(categoryRepo.create).toHaveBeenCalledTimes(2);
    });

    it('skips backfill for a debt whose name collides with another category (criterion 12)', async () => {
      const repo = createMockRepo();
      const seed = createDebtsStore(repo);
      seed.startSync();
      await seed.useDebtsStore.getState().addDebt(NEW_DEBT);
      const categoryRepo = createMockCategoryRepo([
        { id: 'c-0', name: 'Credit Card', type: 'expense', parentCategory: null },
      ]);

      startWithCategories(repo, categoryRepo);
      await flush();

      expect(categoryRepo.create).not.toHaveBeenCalled();
    });

    it('does not create a second subcategory when two syncs race (criterion 12)', async () => {
      const repo = createMockRepo();
      const seed = createDebtsStore(repo);
      seed.startSync();
      await seed.useDebtsStore.getState().addDebt(NEW_DEBT);
      const categoryRepo = createMockCategoryRepo();
      // Slow create: the category list does not update until after both syncs fire.
      (categoryRepo.create as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5)),
      );

      const { startSync } = createDebtsStore(repo, categoryRepo);
      startSync();
      await flush();

      expect(categoryRepo.create).toHaveBeenCalledTimes(1);
    });

    it('still lets a deleted debt keep its subcategory (out of scope: no cascade)', async () => {
      const repo = createMockRepo();
      const categoryRepo = createMockCategoryRepo();
      const useStore = startWithCategories(repo, categoryRepo);
      await useStore.getState().addDebt(NEW_DEBT);
      const id = useStore.getState().debts[0].id;

      await useStore.getState().deleteDebt(id);

      expect(categoryRepo.delete).not.toHaveBeenCalled();
    });
  });
});
