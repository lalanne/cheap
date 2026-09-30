const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockDoc = jest.fn((...args: unknown[]) => ({ __doc: args }));
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => ({ __query: args }));
const mockOrderBy = jest.fn((...args: unknown[]) => ({ __orderBy: args }));
const mockWhere = jest.fn((...args: unknown[]) => ({ __where: args }));
const mockGetDocs = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit }));
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
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
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

  it('writes cardId as null when the expense was not paid with a card (spec 002 2026-09-29 amendment)', async () => {
    mockGetAuth ? mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } }) : undefined;
    await firestoreTransactionRepository.create({
      type: 'expense',
      amount: 45000,
      category: 'Groceries',
      date: new Date('2026-09-29'),
      note: null,
    });

    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cardId: null }));
  });

  it('writes the given cardId when the expense was paid with a card', async () => {
    mockGetAuth ? mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } }) : undefined;
    await firestoreTransactionRepository.create({
      type: 'expense',
      amount: 45000,
      category: 'Groceries',
      date: new Date('2026-09-29'),
      note: null,
      cardId: 'card-1',
    });

    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cardId: 'card-1' }));
  });

  it('updates cardId only when it is included in the update, same as any other field', async () => {
    mockGetAuth ? mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } }) : undefined;
    await firestoreTransactionRepository.update('tx-1', { cardId: 'card-2' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cardId: 'card-2' }));

    mockUpdateDoc.mockClear();
    await firestoreTransactionRepository.update('tx-1', { amount: 5000 });

    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ cardId: expect.anything() }));
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

  it('renames a category across every matching transaction (spec 002 2026-09-24 amendment)', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
    const doc1 = { id: 'tx-1', ref: { __ref: 'tx-1' } };
    const doc2 = { id: 'tx-2', ref: { __ref: 'tx-2' } };
    mockGetDocs.mockResolvedValue({ empty: false, docs: [doc1, doc2] });

    await firestoreTransactionRepository.renameCategoryInTransactions('Uber Eats', 'Food Delivery');

    expect(mockWhere).toHaveBeenCalledWith('category', '==', 'Uber Eats');
    expect(mockBatchUpdate).toHaveBeenCalledWith(doc1.ref, expect.objectContaining({ category: 'Food Delivery' }));
    expect(mockBatchUpdate).toHaveBeenCalledWith(doc2.ref, expect.objectContaining({ category: 'Food Delivery' }));
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('does nothing when no transactions use the old category name', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    await firestoreTransactionRepository.renameCategoryInTransactions('Nonexistent', 'New Name');

    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});
