const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockDoc = jest.fn((...args: unknown[]) => ({ __doc: args }));
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn((...args: unknown[]) => ({ __query: args }));
const mockWhere = jest.fn((...args: unknown[]) => ({ __where: args }));
const mockGetDocs = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockWriteBatch = jest.fn(() => ({ update: mockBatchUpdate, commit: mockBatchCommit }));
const mockServerTimestamp = jest.fn(() => 'server-timestamp');

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

const mockGetAuth = jest.fn();

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  onAuthStateChanged: jest.fn(() => jest.fn()),
}));

import { firestoreBudgetRepository } from '../firestoreBudgetRepository.native';

describe('firestoreBudgetRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'budget-1' });
  });

  it('writes under the signed-in uid', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    const created = await firestoreBudgetRepository.create('Food', 250000);

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/budgets');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ category: 'Food', monthlyLimit: 250000 })
    );
    expect(created).toMatchObject({ id: 'budget-1', category: 'Food', monthlyLimit: 250000 });
  });

  it('throws a clear error when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(firestoreBudgetRepository.create('Food', 250000)).rejects.toThrow(
      'No signed-in user'
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('updates and deletes at the same uid-scoped path', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    await firestoreBudgetRepository.update('budget-1', 300000);
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/budgets/budget-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ monthlyLimit: 300000 }));

    await firestoreBudgetRepository.delete('budget-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('renames a category across the matching budget (spec 002 2026-09-24 amendment)', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
    const budgetDoc = { id: 'budget-1', ref: { __ref: 'budget-1' } };
    mockGetDocs.mockResolvedValue({ empty: false, docs: [budgetDoc] });

    await firestoreBudgetRepository.renameCategoryInBudgets('Uber Eats', 'Food Delivery');

    expect(mockWhere).toHaveBeenCalledWith('category', '==', 'Uber Eats');
    expect(mockBatchUpdate).toHaveBeenCalledWith(budgetDoc.ref, expect.objectContaining({ category: 'Food Delivery' }));
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('does nothing when no budget uses the old category name', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    await firestoreBudgetRepository.renameCategoryInBudgets('Nonexistent', 'New Name');

    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});
