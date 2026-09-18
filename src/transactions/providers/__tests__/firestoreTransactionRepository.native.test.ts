const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockDoc = jest.fn((...args: unknown[]) => ({ __doc: args }));
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => ({ __query: args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ __orderBy: args }));
const mockServerTimestamp = jest.fn(() => 'server-timestamp');

// jest.mock() factories are hoisted above other module-level code, so a
// class referenced by name from outside can still be undefined when the
// factory actually runs — defined inline here instead of via an external
// MockTimestamp to sidestep that entirely.
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  serverTimestamp: () => mockServerTimestamp(),
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

import { firestoreTransactionRepository } from '../firestoreTransactionRepository.native';

describe('firestoreTransactionRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'tx-1' });
  });

  it('writes under the signed-in uid (regression: native has its own auth session, not the web SDK)', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    await firestoreTransactionRepository.create({
      type: 'expense',
      amount: 45000,
      category: 'Food',
      date: new Date('2026-09-18'),
      note: null,
    });

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/transactions');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'expense', amount: 45000, category: 'Food' })
    );
  });

  it('throws a clear error instead of silently doing nothing when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(
      firestoreTransactionRepository.create({
        type: 'expense',
        amount: 1000,
        category: 'Food',
        date: new Date(),
        note: null,
      })
    ).rejects.toThrow('No signed-in user');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('updates and deletes at the same uid-scoped path', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    await firestoreTransactionRepository.update('tx-1', { amount: 5000 });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/transactions/tx-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 5000 }));

    await firestoreTransactionRepository.delete('tx-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
