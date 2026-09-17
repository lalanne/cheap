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

const profile = (displayName: string) => ({
  displayName,
  email: `${displayName.toLowerCase()}@example.com`,
  photoUrl: null,
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

function unauthedDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function unverifiedDb(uid: string) {
  return testEnv.authenticatedContext(uid, { email_verified: false }).firestore();
}

function verifiedDb(uid: string) {
  return testEnv.authenticatedContext(uid, { email_verified: true }).firestore();
}

describe('firestore.rules — users/{uid} (spec 001)', () => {
  it('denies all reads/writes from an unauthenticated client (criterion 11)', async () => {
    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}`)));
    await assertFails(setDoc(doc(unauthedDb(), `users/${ALICE}`), profile('Alice')));
  });

  it('denies an authenticated-but-unverified client (criteria 3, 11)', async () => {
    await assertFails(getDoc(doc(unverifiedDb(ALICE), `users/${ALICE}`)));
    await assertFails(setDoc(doc(unverifiedDb(ALICE), `users/${ALICE}`), profile('Alice')));
  });

  it('lets a verified user read and write only their own profile', async () => {
    const aliceDb = verifiedDb(ALICE);

    await assertSucceeds(setDoc(doc(aliceDb, `users/${ALICE}`), profile('Alice')));
    await assertSucceeds(getDoc(doc(aliceDb, `users/${ALICE}`)));
  });

  it("denies a verified user reading or writing someone else's profile", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${BOB}`), profile('Bob'));
    });

    const aliceDb = verifiedDb(ALICE);

    await assertFails(getDoc(doc(aliceDb, `users/${BOB}`)));
    await assertFails(setDoc(doc(aliceDb, `users/${BOB}`), profile('Hacked')));
  });

  it('denies a signed-out client after a real user signs out (criterion 10)', async () => {
    // Sign-out itself is client-side auth state, not a rules concern — this
    // confirms the rules-side half: once there's no auth context, data is
    // unreadable regardless of what previously happened in the session.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ALICE}`), profile('Alice'));
    });

    await assertFails(getDoc(doc(unauthedDb(), `users/${ALICE}`)));
  });
});
