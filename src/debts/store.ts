import { createDebtsStore } from './debtsStore';
import { firestoreCategoryRepository } from '../transactions/providers/firestoreCategoryRepository';
import { firestoreDebtRepository } from './providers/firestoreDebtRepository';

const { useDebtsStore, startSync } = createDebtsStore(
  firestoreDebtRepository,
  firestoreCategoryRepository,
);

export { useDebtsStore };
// Called from App.tsx inside a useEffect, not here — see debtsStore.ts.
export const startDebtsSync = startSync;
