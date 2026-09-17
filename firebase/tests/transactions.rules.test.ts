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

const transaction = () => ({
  type: 'expense',
  amount: 45000,
  category: 'Food',
  date: new Date('2026-09-17'),
  note: null,
  createdAt: new Date('2026-09-17'),
  updatedAt: new Date('2026-09-17'),
});

const category = () => ({ name: 'Pets', type: 'expense' });

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

describe('firestore.rules — users/{uid}/transactions (spec 002)', () => {
  it('lets a verified user read and write their own transactions', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/transactions/t1`), transaction()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/transactions/t1`)));
  });

  it("denies a verified user reading or writing another user's transactions (criterion 7)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}/transactions/t1`), transaction());
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/transactions/t1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/transactions/t2`), transaction()));
  });

  it('denies an unauthenticated or unverified client', async () => {
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/transactions/t1`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/transactions/t1`)));
  });
});

describe('firestore.rules — users/{uid}/categories (spec 002)', () => {
  it('lets a verified user read and write their own custom categories', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/categories/c1`), category()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/categories/c1`)));
  });

  it("denies a verified user reading or writing another user's categories (criterion 7)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}/categories/c1`), category());
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/categories/c1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/categories/c2`), category()));
  });
});
