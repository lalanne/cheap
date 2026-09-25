const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
let mockRefCounter = 0;
const mockDoc = jest.fn((...args: unknown[]) => ({ id: `ref-${++mockRefCounter}`, __doc: args }));
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockServerTimestamp = jest.fn(() => 'server-timestamp');
const mockRunTransaction = jest.fn();

// jest.mock() factories are hoisted above other module-level code, so the
// mock Timestamp class must be defined inline here rather than referenced
// from an externally-declared class (same lesson as the debts repo test).
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  serverTimestamp: () => mockServerTimestamp(),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: class {
    date: Date;
    constructor(date: Date) {
      this.date = date;
    }
    static fromDate(date: Date) {
      return new this(date);
    }
    toDate() {
      return this.date;
    }
  },
}));

const mockGetAuth = jest.fn();
const mockOnAuthStateChanged = jest.fn((..._args: unknown[]) => jest.fn());

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
}));

import { OVERDRAFT_CHARGES_CATEGORY } from '../../types';
import { firestoreOverdraftRepository } from '../firestoreOverdraftRepository.native';

const DATE = new Date('2026-09-24T12:00:00');

function collectionPaths(): string[] {
  return mockCollection.mock.calls.map((c) => c[1] as string);
}

function docPaths(): string[] {
  return mockDoc.mock.calls.map((c) => c[1] as string).filter((p) => typeof p === 'string');
}

// Runs the callback given to runTransaction against a fake transaction and
// returns the fake, so a test can assert exactly what was written together.
function stubTransaction(getResult?: () => Promise<{ data: () => unknown }>) {
  const t = {
    get: jest.fn(getResult ?? (async () => ({ data: () => undefined }))),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  mockRunTransaction.mockImplementation(async (_db, updateFn) => {
    await updateFn(t);
  });
  return t;
}

describe('firestoreOverdraftRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefCounter = 0;
    mockAddDoc.mockResolvedValue({ id: 'event-1' });
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
  });

  it('throws a clear error when nobody is signed in, without writing', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(
      firestoreOverdraftRepository.logDraw({ amount: 150000, date: DATE, note: null })
    ).rejects.toThrow('No signed-in user');
    expect(mockAddDoc).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  describe('saveLine (criterion 1)', () => {
    it('writes the singleton line doc under the signed-in uid', async () => {
      const t = stubTransaction();

      await firestoreOverdraftRepository.saveLine({
        limit: 2000000,
        monthlyRate: 1.9,
        plannedMonthlyPayment: 300000,
      });

      expect(docPaths()).toContain('users/uid-1/overdraft/line');
      expect(t.set).toHaveBeenCalledTimes(1);
      expect(t.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 2000000, monthlyRate: 1.9, plannedMonthlyPayment: 300000 })
      );
    });

    it('stores a missing planned payment as null', async () => {
      const t = stubTransaction();

      await firestoreOverdraftRepository.saveLine({ limit: 2000000, monthlyRate: 1.9 });

      expect(t.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ plannedMonthlyPayment: null })
      );
    });

    it('also writes an "Opening balance" draw event, in the same transaction, when one is given', async () => {
      const t = stubTransaction();

      await firestoreOverdraftRepository.saveLine({
        limit: 2000000,
        monthlyRate: 1.9,
        openingBalance: 1240000,
        openingDate: DATE,
      });

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(t.set).toHaveBeenCalledTimes(2);
      expect(collectionPaths()).toContain('users/uid-1/overdraftEvents');
      expect(t.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'draw',
          amount: 1240000,
          note: 'Opening balance',
          transactionId: null,
        })
      );
    });

    it('stores an unknown rate as null and a real 0% rate as 0 (amendment, criterion 16)', async () => {
      const t = stubTransaction();

      await firestoreOverdraftRepository.saveLine({ limit: 2000000, monthlyRate: null });
      expect(t.set).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ monthlyRate: null }));

      await firestoreOverdraftRepository.saveLine({ limit: 2000000, monthlyRate: 0 });
      expect(t.set).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ monthlyRate: 0 }));
    });

    it('writes no event when there is no opening balance', async () => {
      const t = stubTransaction();

      await firestoreOverdraftRepository.saveLine({ limit: 2000000, monthlyRate: 1.9, openingBalance: null });

      expect(t.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateLine (criterion 15)', () => {
    it('updates only the line doc — no event, no transaction', async () => {
      await firestoreOverdraftRepository.updateLine({ monthlyRate: 2.1, plannedMonthlyPayment: 350000 });

      expect(docPaths()).toContain('users/uid-1/overdraft/line');
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ monthlyRate: 2.1, plannedMonthlyPayment: 350000, updatedAt: 'server-timestamp' })
      );
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  describe('updateLine — clearing the rate (amendment, criterion 20)', () => {
    it('passes a null rate through to the line doc', async () => {
      await firestoreOverdraftRepository.updateLine({ monthlyRate: null });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ monthlyRate: null })
      );
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });

  describe('subscribeLine — reading the rate (amendment, criterion 20)', () => {
    function deliver(data: Record<string, unknown> | undefined) {
      const callback = jest.fn();
      firestoreOverdraftRepository.subscribeLine(callback);
      const onAuth = mockOnAuthStateChanged.mock.calls[0][1] as (user: { uid: string } | null) => void;
      onAuth({ uid: 'uid-1' });
      const onSnap = mockOnSnapshot.mock.calls[0][1] as (snap: { data: () => unknown }) => void;
      onSnap({ data: () => data });
      return callback;
    }

    it('reads a line doc with no monthlyRate field as an unknown (null) rate', () => {
      const callback = deliver({ limit: 2000000, plannedMonthlyPayment: null });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ limit: 2000000, monthlyRate: null }));
    });

    it('keeps a numeric rate, including 0, as is', () => {
      expect(deliver({ limit: 2000000, monthlyRate: 1.9 })).toHaveBeenCalledWith(
        expect.objectContaining({ monthlyRate: 1.9 })
      );
    });
  });

  describe('draws and payments (criterion 5)', () => {
    it('logs a draw as one event under the uid and touches no transaction', async () => {
      await firestoreOverdraftRepository.logDraw({ amount: 150000, date: DATE, note: 'Auto top-up' });

      expect(collectionPaths()).toContain('users/uid-1/overdraftEvents');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'draw', amount: 150000, note: 'Auto top-up', transactionId: null })
      );
      expect(collectionPaths()).not.toContain('users/uid-1/transactions');
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it('logs a payment as one event and touches no transaction — principal is not an expense', async () => {
      await firestoreOverdraftRepository.logPayment({ amount: 300000, date: DATE });

      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'payment', amount: 300000, note: null, transactionId: null })
      );
      expect(collectionPaths()).not.toContain('users/uid-1/transactions');
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  describe('charges (criterion 6)', () => {
    it.each([
      ['interest', 23560],
      ['fee', 4990],
    ] as const)('logs %s atomically: the event and a linked expense, in one Firestore transaction', async (type, amount) => {
      const t = stubTransaction();

      await firestoreOverdraftRepository.logCharge(type, { amount, date: DATE, note: 'August statement' });

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(t.set).toHaveBeenCalledTimes(2);

      const expenseCall = t.set.mock.calls.find(([, data]) => (data as { type: string }).type === 'expense');
      const eventCall = t.set.mock.calls.find(([, data]) => (data as { type: string }).type === type);
      expect(expenseCall).toBeDefined();
      expect(eventCall).toBeDefined();

      expect(expenseCall![1]).toMatchObject({
        type: 'expense',
        amount,
        category: OVERDRAFT_CHARGES_CATEGORY,
        note: 'August statement',
      });
      expect(eventCall![1]).toMatchObject({ type, amount, note: 'August statement' });
      // The event points at the exact expense doc written in the same transaction.
      expect((eventCall![1] as { transactionId: string }).transactionId).toBe((expenseCall![0] as { id: string }).id);
      expect(collectionPaths()).toEqual(
        expect.arrayContaining(['users/uid-1/transactions', 'users/uid-1/overdraftEvents'])
      );
    });

    it('writes neither half when the transaction aborts', async () => {
      const t = { get: jest.fn(), set: jest.fn(), update: jest.fn(), delete: jest.fn() };
      mockRunTransaction.mockImplementation(async (_db, updateFn) => {
        await updateFn(t);
        throw new Error('aborted');
      });

      await expect(
        firestoreOverdraftRepository.logCharge('interest', { amount: 23560, date: DATE })
      ).rejects.toThrow('aborted');
      // Both halves were only ever staged inside the transaction; nothing was written outside it.
      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvent (criterion 6 — cascade)', () => {
    it('deletes a charge together with its linked expense, in one transaction', async () => {
      const t = stubTransaction(async () => ({
        data: () => ({ type: 'interest', amount: 23560, transactionId: 'tx-9' }),
      }));

      await firestoreOverdraftRepository.deleteEvent('event-1');

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(docPaths()).toEqual(
        expect.arrayContaining(['users/uid-1/overdraftEvents/event-1', 'users/uid-1/transactions/tx-9'])
      );
      expect(t.delete).toHaveBeenCalledTimes(2);
    });

    it('deletes a draw on its own — it has no linked expense', async () => {
      const t = stubTransaction(async () => ({
        data: () => ({ type: 'draw', amount: 150000, transactionId: null }),
      }));

      await firestoreOverdraftRepository.deleteEvent('event-2');

      expect(docPaths()).toContain('users/uid-1/overdraftEvents/event-2');
      expect(docPaths().some((p) => p.startsWith('users/uid-1/transactions/'))).toBe(false);
      expect(t.delete).toHaveBeenCalledTimes(1);
    });

    it('rejects when the event is not found, deleting nothing', async () => {
      const t = stubTransaction(async () => ({ data: () => undefined }));

      await expect(firestoreOverdraftRepository.deleteEvent('missing')).rejects.toThrow('Event not found');
      expect(t.delete).not.toHaveBeenCalled();
    });
  });
});
