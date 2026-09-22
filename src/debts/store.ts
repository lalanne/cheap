import { createDebtsStore } from './debtsStore';
import { firestoreDebtRepository } from './providers/firestoreDebtRepository';

const { useDebtsStore, startSync } = createDebtsStore(firestoreDebtRepository);

export { useDebtsStore };
// Called from App.tsx inside a useEffect, not here — see debtsStore.ts.
export const startDebtsSync = startSync;
