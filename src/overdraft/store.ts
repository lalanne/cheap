import { createOverdraftStore } from './overdraftStore';
import { firestoreOverdraftRepository } from './providers/firestoreOverdraftRepository';

const { useOverdraftStore, startSync } = createOverdraftStore(firestoreOverdraftRepository);

export { useOverdraftStore };
// Called from App.tsx inside a useEffect, not here — see overdraftStore.ts.
export const startOverdraftSync = startSync;
