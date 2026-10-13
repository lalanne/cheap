const mockGetFirestore = jest.fn(() => ({}));
const mockCollection = jest.fn((...args: unknown[]) => ({ __collection: args }));
const mockDoc = jest.fn((...args: unknown[]) => ({ __doc: args }));
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockServerTimestamp = jest.fn(() => 'server-timestamp');

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
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

import { firestoreCreditCardRepository } from '../firestoreCreditCardRepository.native';
import { firestoreCreditCardPaymentRepository } from '../firestoreCreditCardPaymentRepository.native';

describe('firestoreCreditCardRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'card-1' });
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
  });

  it('creates a card under the signed-in uid, with an unset rate stored as null (criterion 1)', async () => {
    const created = await firestoreCreditCardRepository.create({
      name: 'Visa CLP',
      limit: 2000000,
      minimumPayment: 100000,
    });

    expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/creditCards');
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'Visa CLP',
        limit: 2000000,
        minimumPayment: 100000,
        monthlyRate: null,
      }),
    );
    expect(created).toMatchObject({ id: 'card-1', name: 'Visa CLP', monthlyRate: null });
  });

  it('throws a clear error when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(
      firestoreCreditCardRepository.create({
        name: 'Visa CLP',
        limit: 2000000,
        minimumPayment: 100000,
      }),
    ).rejects.toThrow('No signed-in user');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('updates only the given fields, and deletes at the same uid-scoped path', async () => {
    await firestoreCreditCardRepository.update('card-1', { monthlyRate: 3.45 });
    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/creditCards/card-1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ monthlyRate: 3.45 }),
    );

    await firestoreCreditCardRepository.delete('card-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
  });
});

describe('firestoreCreditCardPaymentRepository (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'payment-1' });
    mockGetAuth.mockReturnValue({ currentUser: { uid: 'uid-1' } });
  });

  it('logs a payment as one event, no linked transaction (criterion 5 — payments are not expenses)', async () => {
    await firestoreCreditCardPaymentRepository.logPayment({
      cardId: 'card-1',
      amount: 50000,
      date: new Date('2026-09-24'),
      note: 'Statement payment',
    });

    expect(mockCollection).toHaveBeenCalledWith(
      expect.anything(),
      'users/uid-1/creditCardPayments',
    );
    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cardId: 'card-1', amount: 50000, note: 'Statement payment' }),
    );
    expect(mockCollection).not.toHaveBeenCalledWith(expect.anything(), 'users/uid-1/transactions');
  });

  it('stores a missing note as null', async () => {
    await firestoreCreditCardPaymentRepository.logPayment({
      cardId: 'card-1',
      amount: 50000,
      date: new Date('2026-09-24'),
    });

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ note: null }),
    );
  });

  it('deletes a payment at the uid-scoped path', async () => {
    await firestoreCreditCardPaymentRepository.deletePayment('payment-1');

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      'users/uid-1/creditCardPayments/payment-1',
    );
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('throws a clear error when nobody is signed in', async () => {
    mockGetAuth.mockReturnValue({ currentUser: null });

    await expect(
      firestoreCreditCardPaymentRepository.logPayment({
        cardId: 'card-1',
        amount: 50000,
        date: new Date(),
      }),
    ).rejects.toThrow('No signed-in user');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
