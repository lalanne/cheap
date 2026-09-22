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

const debt = () => ({
  name: 'Credit Card',
  originalAmount: 2000000,
  currentBalance: 2000000,
  minimumPayment: 100000,
  interestRate: null,
  createdAt: new Date('2026-09-17'),
  updatedAt: new Date('2026-09-17'),
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

describe('firestore.rules — users/{uid}/debts (spec 008)', () => {
  it('lets a verified user read and write their own debts', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/debts/d1`), debt()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/debts/d1`)));
  });

  it("denies a verified user reading or writing another user's debts (criterion 7)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}/debts/d1`), debt());
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/debts/d1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/debts/d2`), debt()));
  });

  it('denies an unauthenticated or unverified client', async () => {
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/debts/d1`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/debts/d1`)));
  });
});
