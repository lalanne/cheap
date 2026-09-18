const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockAddDoc = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
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

    const created = await firestoreCategoryRepository.create('Pets', 'both');

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/categories');
    expect(mockAddDoc).toHaveBeenCalledWith(expect.anything(), { name: 'Pets', type: 'both' });
    expect(created).toEqual({ id: 'cat-1', name: 'Pets', type: 'both' });
  });

  it('throws a clear error when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(firestoreCategoryRepository.create('Pets', 'both')).rejects.toThrow(
      'No signed-in user'
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
