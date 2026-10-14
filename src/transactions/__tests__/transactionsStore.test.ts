import { createTransactionsStore } from '../transactionsStore';
import type {
  Category,
  CategoryRepository,
  CategoryType,
  NewTransactionInput,
  Transaction,
  TransactionRepository,
  UpdateTransactionInput,
} from '../types';

function createMockRepos() {
  let transactions: Transaction[] = [];
  let categories: Category[] = [];
  let txListener: ((t: Transaction[]) => void) | null = null;
  let catListener: ((c: Category[]) => void) | null = null;
  let nextId = 1;

  const transactionsRepo: TransactionRepository = {
    subscribe: jest.fn((callback) => {
      txListener = callback;
      callback(transactions);
      return () => {
        txListener = null;
      };
    }),
    create: jest.fn(async (input: NewTransactionInput) => {
      const now = new Date();
      const tx: Transaction = {
        id: `tx-${nextId++}`,
        type: input.type,
        amount: input.amount,
        category: input.category,
        date: input.date,
        note: input.note ?? null,
        createdAt: now,
        updatedAt: now,
      };
      transactions = [...transactions, tx];
      txListener?.(transactions);
      return tx;
    }),
    update: jest.fn(async (id: string, input: UpdateTransactionInput) => {
      transactions = transactions.map((t) =>
        t.id === id ? { ...t, ...input, updatedAt: new Date() } : t,
      );
      txListener?.(transactions);
    }),
    delete: jest.fn(async (id: string) => {
      transactions = transactions.filter((t) => t.id !== id);
      txListener?.(transactions);
    }),
    renameCategoryInTransactions: jest.fn(async (oldName: string, newName: string) => {
      transactions = transactions.map((t) =>
        t.category === oldName ? { ...t, category: newName } : t,
      );
      txListener?.(transactions);
    }),
  };

  const categoriesRepo: CategoryRepository = {
    subscribe: jest.fn((callback) => {
      catListener = callback;
      callback(categories);
      return () => {
        catListener = null;
      };
    }),
    create: jest.fn(async (name: string, type: CategoryType, parentCategory: string | null) => {
      const cat: Category = { id: `cat-${nextId++}`, name, type, parentCategory };
      categories = [...categories, cat];
      catListener?.(categories);
      return cat;
    }),
    delete: jest.fn(async (id: string) => {
      categories = categories.filter((c) => c.id !== id);
      catListener?.(categories);
    }),
    update: jest.fn(async (id: string, name: string, parentCategory: string | null) => {
      categories = categories.map((c) => (c.id === id ? { ...c, name, parentCategory } : c));
      catListener?.(categories);
    }),
  };

  return { transactions: transactionsRepo, categories: categoriesRepo };
}

function createStartedStore(repos: ReturnType<typeof createMockRepos>) {
  const { useTransactionsStore, startSync } = createTransactionsStore(repos);
  startSync();
  return useTransactionsStore;
}

describe('transactionsStore', () => {
  it('does not touch the repositories until startSync is called', () => {
    const repos = createMockRepos();
    createTransactionsStore(repos);

    expect(repos.transactions.subscribe).not.toHaveBeenCalled();
    expect(repos.categories.subscribe).not.toHaveBeenCalled();
  });

  it('swallows a repository that throws when starting sync, instead of crashing', () => {
    const repos = createMockRepos();
    (repos.transactions.subscribe as jest.Mock).mockImplementation(() => {
      throw new Error('native bridge not ready');
    });
    const { startSync } = createTransactionsStore(repos);

    expect(() => startSync()).not.toThrow();
  });

  it('creates a transaction and reflects it in the list (criterion 1)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);

    await useStore.getState().addTransaction({
      type: 'expense',
      amount: 45000,
      category: 'Food',
      date: new Date('2026-09-17'),
      note: null,
    });

    expect(repos.transactions.create).toHaveBeenCalledWith({
      type: 'expense',
      amount: 45000,
      category: 'Food',
      date: new Date('2026-09-17'),
      note: null,
    });
    expect(useStore.getState().transactions).toHaveLength(1);
    expect(useStore.getState().transactions[0]).toMatchObject({
      type: 'expense',
      amount: 45000,
      category: 'Food',
    });
  });

  it('sorts by transaction date descending, not creation order (criterion 5)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);

    // Logged today, dated yesterday.
    await useStore.getState().addTransaction({
      type: 'expense',
      amount: 1000,
      category: 'Food',
      date: new Date('2026-09-16'),
      note: 'Yesterday coffee, logged late',
    });
    // Logged after, but dated today — should sort first.
    await useStore.getState().addTransaction({
      type: 'expense',
      amount: 2000,
      category: 'Food',
      date: new Date('2026-09-17'),
      note: null,
    });

    const dates = useStore.getState().transactions.map((t) => t.date.toISOString());
    expect(dates).toEqual([
      new Date('2026-09-17').toISOString(),
      new Date('2026-09-16').toISOString(),
    ]);
  });

  it('edits a transaction in place, not as a duplicate (criterion 3)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);
    await useStore.getState().addTransaction({
      type: 'expense',
      amount: 1000,
      category: 'Food',
      date: new Date('2026-09-17'),
      note: null,
    });
    const id = useStore.getState().transactions[0].id;
    const originalUpdatedAt = useStore.getState().transactions[0].updatedAt;

    await useStore.getState().updateTransaction(id, { amount: 5000 });

    expect(useStore.getState().transactions).toHaveLength(1);
    const updated = useStore.getState().transactions[0];
    expect(updated.id).toBe(id);
    expect(updated.amount).toBe(5000);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
  });

  it('deletes a transaction (criterion 4)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);
    await useStore.getState().addTransaction({
      type: 'expense',
      amount: 1000,
      category: 'Food',
      date: new Date('2026-09-17'),
      note: null,
    });
    const id = useStore.getState().transactions[0].id;

    await useStore.getState().deleteTransaction(id);

    expect(useStore.getState().transactions).toHaveLength(0);
  });

  it('custom categories are selectable immediately and persist across a reload (criterion 6)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);

    const created = await useStore.getState().addCategory('Pets', 'expense', null);

    expect(useStore.getState().categories).toContainEqual(created);

    // Simulate an app restart: a fresh store subscribing to the same
    // backing data should see the category was actually persisted, not
    // just held in the first store's memory.
    const reloadedStore = createStartedStore(repos);
    expect(reloadedStore.getState().categories).toContainEqual(created);
  });

  it('creates a subcategory with its parent name (spec 011)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);

    const created = await useStore.getState().addCategory('Uber Eats', 'expense', 'Food');

    expect(created.parentCategory).toBe('Food');
    expect(repos.categories.create).toHaveBeenCalledWith('Uber Eats', 'expense', 'Food');
  });

  it('deletes a custom category (spec 002 criterion 9)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);
    const created = await useStore.getState().addCategory('Pets', 'expense', null);

    await useStore.getState().deleteCategory(created.id);

    expect(repos.categories.delete).toHaveBeenCalledWith(created.id);
    expect(useStore.getState().categories).not.toContainEqual(created);
  });

  it('renames a category and cascades to matching transactions when the name changed (spec 002 2026-09-24 amendment, criterion 10)', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);
    const created = await useStore.getState().addCategory('Uber Eats', 'expense', 'Food');
    await useStore.getState().addTransaction({
      type: 'expense',
      amount: 5000,
      category: 'Uber Eats',
      date: new Date(),
    });

    await useStore.getState().updateCategory(created.id, 'Food Delivery', 'Food', 'Uber Eats');

    expect(repos.categories.update).toHaveBeenCalledWith(created.id, 'Food Delivery', 'Food');
    expect(repos.transactions.renameCategoryInTransactions).toHaveBeenCalledWith(
      'Uber Eats',
      'Food Delivery',
    );
    expect(useStore.getState().transactions[0].category).toBe('Food Delivery');
  });

  it('does not cascade a rename when only the parent changed, not the name', async () => {
    const repos = createMockRepos();
    const useStore = createStartedStore(repos);
    const created = await useStore.getState().addCategory('Yoga Classes', 'expense', 'Gym');

    await useStore.getState().updateCategory(created.id, 'Yoga Classes', null, 'Yoga Classes');

    expect(repos.categories.update).toHaveBeenCalledWith(created.id, 'Yoga Classes', null);
    expect(repos.transactions.renameCategoryInTransactions).not.toHaveBeenCalled();
  });
});

describe('transactionsStore — cardId (spec 002 2026-09-29 amendment)', () => {
  it('passes cardId through when creating an expense tagged with a card', async () => {
    const repos = createMockRepos();
    const { useTransactionsStore } = createTransactionsStore(repos);

    await useTransactionsStore.getState().addTransaction({
      type: 'expense',
      amount: 45000,
      category: 'Groceries',
      date: new Date('2026-09-29'),
      note: null,
      cardId: 'card-1',
    });

    expect(repos.transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ cardId: 'card-1' }),
    );
  });

  it('passes a cardId update through like any other field', async () => {
    const repos = createMockRepos();
    const { useTransactionsStore } = createTransactionsStore(repos);

    await useTransactionsStore.getState().updateTransaction('tx-1', { cardId: 'card-2' });

    expect(repos.transactions.update).toHaveBeenCalledWith('tx-1', { cardId: 'card-2' });
  });
});
