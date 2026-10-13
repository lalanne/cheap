const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockDoc = jest.fn((...args: unknown[]) => ({ __doc: args }));
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockServerTimestamp = jest.fn(() => 'server-timestamp');
const mockRunTransaction = jest.fn();

// jest.mock() factories are hoisted above other module-level code, so the
// mock Timestamp class must be defined inline here rather than referenced
// from an externally-declared class (see the same lesson already noted in
// the native transactions repo tests).
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
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

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  onAuthStateChanged: jest.fn(() => jest.fn()),
}));

import { firestoreDebtRepository } from '../firestoreDebtRepository.native';

describe('firestoreDebtRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'debt-1' });
  });

  it('writes under the signed-in uid', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    const created = await firestoreDebtRepository.create({
      name: 'Credit Card',
      originalAmount: 2000000,
      currentBalance: 2000000,
      minimumPayment: 100000,
      interestRate: null,
    });

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/debts');
    expect(created).toMatchObject({ id: 'debt-1', name: 'Credit Card', currentBalance: 2000000 });
  });

  it('throws a clear error when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(
      firestoreDebtRepository.create({
        name: 'Credit Card',
        originalAmount: 2000000,
        currentBalance: 2000000,
        minimumPayment: 100000,
        interestRate: null,
      }),
    ).rejects.toThrow('No signed-in user');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('updates the balance directly and deletes at the same uid-scoped path', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    await firestoreDebtRepository.updateBalance('debt-1', 1800000);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/debts/debt-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentBalance: 1800000 }),
    );

    await firestoreDebtRepository.delete('debt-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('logs a payment atomically: a linked expense transaction and the decreased balance, in one Firestore transaction (criterion 2)', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
    const mockGet = jest
      .fn()
      .mockResolvedValue({ data: () => ({ name: 'Credit Card', currentBalance: 1200000 }) });
    const mockSet = jest.fn();
    const mockUpdate = jest.fn();
    mockRunTransaction.mockImplementation(async (_db, updateFn) => {
      await updateFn({ get: mockGet, set: mockSet, update: mockUpdate });
    });

    await firestoreDebtRepository.logPayment('debt-1', 50000);

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'expense', amount: 50000, category: 'Credit Card' }),
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ currentBalance: 1150000 }),
    );
  });

  it('rejects logPayment when the debt is not found, without writing anything', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
    const mockGet = jest.fn().mockResolvedValue({ data: () => undefined });
    const mockSet = jest.fn();
    const mockUpdate = jest.fn();
    mockRunTransaction.mockImplementation(async (_db, updateFn) => {
      await updateFn({ get: mockGet, set: mockSet, update: mockUpdate });
    });

    await expect(firestoreDebtRepository.logPayment('debt-1', 50000)).rejects.toThrow(
      'Debt not found',
    );
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
