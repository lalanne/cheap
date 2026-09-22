import { createBudgetsStore } from './budgetsStore';
import { firestoreBudgetRepository } from './providers/firestoreBudgetRepository';

const { useBudgetsStore, startSync } = createBudgetsStore(firestoreBudgetRepository);

export { useBudgetsStore };
// Called from App.tsx inside a useEffect, not here — see budgetsStore.ts.
export const startBudgetsSync = startSync;
