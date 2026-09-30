import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const ALICE = 'alice';
const BOB = 'bob';

const card = () => ({
  name: 'Visa CLP',
  limit: 2000000,
  minimumPayment: 100000,
  monthlyRate: 3.45,
  createdAt: new Date('2026-09-29'),
  updatedAt: new Date('2026-09-29'),
});

const payment = () => ({
  cardId: 'card-1',
  amount: 50000,
  date: new Date('2026-09-24'),
  note: null,
  createdAt: new Date('2026-09-24'),
});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-cheap',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

function verifiedDb(uid: string) {
  return testEnv.authenticatedContext(uid, { email_verified: true }).firestore();
}

function unverifiedDb(uid: string) {
  return testEnv.authenticatedContext(uid, { email_verified: false }).firestore();
}

function unauthedDb() {
  return testEnv.unauthenticatedContext().firestore();
}

describe('firestore.rules — users/{uid}/creditCards and creditCardPayments (spec 013)', () => {
  it('lets a verified user read and write their own cards and payments', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/creditCards/card-1`), card()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/creditCards/card-1`)));
    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/creditCardPayments/p1`), payment()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/creditCardPayments/p1`)));
  });

  it("denies a verified user reading or writing another user's cards and payments (criterion 9)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}/creditCards/card-1`), card());
      await setDoc(doc(ctx.firestore(), `users/${BOB}/creditCardPayments/p1`), payment());
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/creditCards/card-1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/creditCards/card-2`), card()));
    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/creditCardPayments/p1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/creditCardPayments/p2`), payment()));
  });

  it('denies an unauthenticated or unverified client', async () => {
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/creditCards/card-1`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/creditCards/card-1`)));
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/creditCardPayments/p1`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/creditCardPayments/p1`)));
  });
});
