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

const line = () => ({
  limit: 2000000,
  monthlyRate: 1.9,
  plannedMonthlyPayment: 300000,
  createdAt: new Date('2026-09-25'),
  updatedAt: new Date('2026-09-25'),
});

const event = () => ({
  type: 'draw',
  amount: 150000,
  date: new Date('2026-09-24'),
  note: null,
  transactionId: null,
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

describe('firestore.rules — users/{uid}/overdraft and overdraftEvents (spec 012)', () => {
  it('lets a verified user read and write their own line and events', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/overdraft/line`), line()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/overdraft/line`)));
    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}/overdraftEvents/e1`), event()));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}/overdraftEvents/e1`)));
  });

  it("denies a verified user reading or writing another user's line and events (criterion 13)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}/overdraft/line`), line());
      await setDoc(doc(ctx.firestore(), `users/${BOB}/overdraftEvents/e1`), event());
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/overdraft/line`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/overdraft/line`), line()));
    await assertFails(getDoc(doc(aliceDb, `users/${BOB}/overdraftEvents/e1`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}/overdraftEvents/e2`), event()));
  });

  it('denies an unauthenticated or unverified client', async () => {
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/overdraft/line`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/overdraft/line`)));
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}/overdraftEvents/e1`)));
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}/overdraftEvents/e1`)));
  });
});
