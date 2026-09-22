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

const budget = () => ({
  category: 'Food',
  monthlyLimit: 250000,
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

describe('firestore.rules — users/{uid}/budgets (spec 007)', () => {
  it('lets a verified user read and write their own budgets', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/budgets/b1`), budget()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/budgets/b1`)));
  });

  it("denies a verified user reading or writing another user's budgets (criterion 6)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}/budgets/b1`), budget());
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/budgets/b1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/budgets/b2`), budget()));
  });

  it('denies an unauthenticated or unverified client', async () => {
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/budgets/b1`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/budgets/b1`)));
  });
});
