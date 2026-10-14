import { createDebtsStore } from '../debtsStore';
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
});
