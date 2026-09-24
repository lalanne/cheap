const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockDoc = jest.fn((...args: unknown[]) => ({ __doc: args }));
const mockAddDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

const mockGetAuth = jest.fn();

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: (...args: unknown[]) => mockGetAuth(...args),
  onAuthStateChanged: jest.fn(() => jest.fn()),
}));

import { firestoreCategoryRepository } from '../firestoreCategoryRepository.native';

describe('firestoreCategoryRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'cat-1' });
  });

  it('writes under the signed-in uid', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    const created = await firestoreCategoryRepository.create('Pets', 'both', null);

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/categories');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Pets', type: 'both', parentCategory: null });
    expect(created).toEqual({ id: 'cat-1', name: 'Pets', type: 'both', parentCategory: null });
  });

  it('writes a subcategory with its parent name (spec 011)', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    const created = await firestoreCategoryRepository.create('Uber Eats', 'both', 'Food');

    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), {
      name: 'Uber Eats',
      type: 'both',
      parentCategory: 'Food',
    });
    expect(created).toEqual({ id: 'cat-1', name: 'Uber Eats', type: 'both', parentCategory: 'Food' });
  });

  it('throws a clear error when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(firestoreCategoryRepository.create('Pets', 'both', null)).rejects.toThrow(
      'No signed-in user'
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('deletes at the signed-in uid-scoped path (spec 002 criterion 9)', async () => {
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });

    await firestoreCategoryRepository.delete('cat-1');

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/categories/cat-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});
