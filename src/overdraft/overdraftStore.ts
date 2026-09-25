import { create } from 'zustand';

import type {
  LogMovementInput,
  NewOverdraftLineInput,
  OverdraftEvent,
  OverdraftLine,
  OverdraftLinePatch,
  OverdraftRepository,
} from './types';

type OverdraftState = {
  line: OverdraftLine | null;
  events: OverdraftEvent[];
};

type OverdraftActions = {
  setupLine: (input: NewOverdraftLineInput) => Promise<void>;
  updateLine: (patch: OverdraftLinePatch) => Promise<void>;
  logDraw: (input: LogMovementInput) => Promise<void>;
  logPayment: (input: LogMovementInput) => Promise<void>;
  logInterest: (input: LogMovementInput) => Promise<void>;
  logFee: (input: LogMovementInput) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
};

export type OverdraftStore = OverdraftState & OverdraftActions;

export function createOverdraftStore(repo: OverdraftRepository) {
  // Atomicity (a charge and its linked expense, together or not at all —
  // spec 012 criterion 6) lives in the repository; the store delegates and
  // lets a rejection propagate rather than swallowing it.
  const useOverdraftStore = create<OverdraftStore>()(() => ({
    line: null,
    events: [],

    setupLine: async (input) => {
      await repo.saveLine(input);
    },
    updateLine: async (patch) => {
      await repo.updateLine(patch);
    },
    logDraw: async (input) => {
      await repo.logDraw(input);
    },
    logPayment: async (input) => {
      await repo.logPayment(input);
    },
    logInterest: async (input) => {
      await repo.logCharge('interest', input);
    },
    logFee: async (input) => {
      await repo.logCharge('fee', input);
    },
    deleteEvent: async (id) => {
      await repo.deleteEvent(id);
    },
  }));

  // Deferred, not called here — same reasoning as debtsStore.ts: touching the
  // native Firestore bridge at module-load time is suspected to cause a real
  // launch crash.
  function startSync(): () => void {
    let unsubscribeLine = () => {};
    let unsubscribeEvents = () => {};
    try {
      unsubscribeLine = repo.subscribeLine((line) => {
        useOverdraftStore.setState({ line });
      });
      unsubscribeEvents = repo.subscribeEvents((events) => {
        useOverdraftStore.setState({ events });
      });
    } catch (e) {
      console.warn('[overdraftStore] failed to start sync', e);
    }
    return () => {
      unsubscribeLine();
      unsubscribeEvents();
    };
  }

  return { useOverdraftStore, startSync };
}
