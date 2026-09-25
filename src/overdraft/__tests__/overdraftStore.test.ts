import { createOverdraftStore } from '../overdraftStore';
import type {
  LogMovementInput,
  NewOverdraftLineInput,
  OverdraftEvent,
  OverdraftLine,
  OverdraftRepository,
} from '../types';

function createMockRepo() {
  let line: OverdraftLine | null = null;
  let events: OverdraftEvent[] = [];
  let lineListener: ((l: OverdraftLine | null) => void) | null = null;
  let eventsListener: ((e: OverdraftEvent[]) => void) | null = null;
  const unsubscribeLine = jest.fn(() => {
    lineListener = null;
  });
  const unsubscribeEvents = jest.fn(() => {
    eventsListener = null;
  });

  const repo: OverdraftRepository = {
    subscribeLine: jest.fn((callback) => {
      lineListener = callback;
      callback(line);
      return unsubscribeLine;
    }),
    subscribeEvents: jest.fn((callback) => {
      eventsListener = callback;
      callback(events);
      return unsubscribeEvents;
    }),
    saveLine: jest.fn(async (input: NewOverdraftLineInput) => {
      const now = new Date();
      line = {
        limit: input.limit,
        monthlyRate: input.monthlyRate,
        plannedMonthlyPayment: input.plannedMonthlyPayment ?? null,
        createdAt: now,
        updatedAt: now,
      };
      lineListener?.(line);
    }),
    updateLine: jest.fn(async () => {}),
    logDraw: jest.fn(async () => {}),
    logPayment: jest.fn(async () => {}),
    logCharge: jest.fn(async () => {}),
    deleteEvent: jest.fn(async () => {}),
  };

  return { repo, unsubscribeLine, unsubscribeEvents, emitEvents: (e: OverdraftEvent[]) => eventsListener?.(e) };
}

const MOVEMENT: LogMovementInput = { amount: 150000, date: new Date('2026-09-24'), note: 'Auto top-up' };

describe('overdraftStore', () => {
  it('does not touch the repository until startSync is called', () => {
    const { repo } = createMockRepo();
    createOverdraftStore(repo);

    expect(repo.subscribeLine).not.toHaveBeenCalled();
    expect(repo.subscribeEvents).not.toHaveBeenCalled();
  });

  it('swallows a repository that throws when starting sync, instead of crashing', () => {
    const { repo } = createMockRepo();
    (repo.subscribeLine as jest.Mock).mockImplementation(() => {
      throw new Error('native bridge not ready');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { startSync } = createOverdraftStore(repo);

    expect(() => startSync()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('mirrors the line and the events from the repository once sync starts', () => {
    const { repo, emitEvents } = createMockRepo();
    const { useOverdraftStore, startSync } = createOverdraftStore(repo);
    startSync();

    expect(useOverdraftStore.getState().line).toBeNull();
    expect(useOverdraftStore.getState().events).toEqual([]);

    const event: OverdraftEvent = {
      id: 'e-1',
      type: 'draw',
      amount: 100000,
      date: new Date('2026-09-01'),
      note: null,
      transactionId: null,
      createdAt: new Date('2026-09-01'),
    };
    emitEvents([event]);

    expect(useOverdraftStore.getState().events).toEqual([event]);
  });

  it('stops both listeners when the returned unsubscribe runs', () => {
    const { repo, unsubscribeLine, unsubscribeEvents } = createMockRepo();
    const { startSync } = createOverdraftStore(repo);

    startSync()();

    expect(unsubscribeLine).toHaveBeenCalled();
    expect(unsubscribeEvents).toHaveBeenCalled();
  });

  it('sets the line up through the repository, with the opening balance (criterion 1)', async () => {
    const { repo } = createMockRepo();
    const { useOverdraftStore, startSync } = createOverdraftStore(repo);
    startSync();

    await useOverdraftStore.getState().setupLine({
      limit: 2000000,
      monthlyRate: 1.9,
      plannedMonthlyPayment: 300000,
      openingBalance: 1240000,
    });

    expect(repo.saveLine).toHaveBeenCalledWith({
      limit: 2000000,
      monthlyRate: 1.9,
      plannedMonthlyPayment: 300000,
      openingBalance: 1240000,
    });
    expect(useOverdraftStore.getState().line).toMatchObject({ limit: 2000000, monthlyRate: 1.9 });
  });

  it('logs a draw as a plain movement — never as a charge (criterion 5)', async () => {
    const { repo } = createMockRepo();
    const { useOverdraftStore } = createOverdraftStore(repo);

    await useOverdraftStore.getState().logDraw(MOVEMENT);

    expect(repo.logDraw).toHaveBeenCalledWith(MOVEMENT);
    expect(repo.logCharge).not.toHaveBeenCalled();
    expect(repo.logPayment).not.toHaveBeenCalled();
  });

  it('logs a payment as a plain movement — never as a charge (criterion 5)', async () => {
    const { repo } = createMockRepo();
    const { useOverdraftStore } = createOverdraftStore(repo);

    await useOverdraftStore.getState().logPayment(MOVEMENT);

    expect(repo.logPayment).toHaveBeenCalledWith(MOVEMENT);
    expect(repo.logCharge).not.toHaveBeenCalled();
    expect(repo.logDraw).not.toHaveBeenCalled();
  });

  it('logs interest and fees as charges, which the repository ties to an expense (criterion 6)', async () => {
    const { repo } = createMockRepo();
    const { useOverdraftStore } = createOverdraftStore(repo);

    await useOverdraftStore.getState().logInterest(MOVEMENT);
    await useOverdraftStore.getState().logFee(MOVEMENT);

    expect(repo.logCharge).toHaveBeenNthCalledWith(1, 'interest', MOVEMENT);
    expect(repo.logCharge).toHaveBeenNthCalledWith(2, 'fee', MOVEMENT);
    expect(repo.logDraw).not.toHaveBeenCalled();
    expect(repo.logPayment).not.toHaveBeenCalled();
  });

  it('lets a repository rejection propagate instead of swallowing it, so a failed charge is not shown as saved (criterion 6)', async () => {
    const { repo } = createMockRepo();
    (repo.logCharge as jest.Mock).mockRejectedValue(new Error('transaction aborted'));
    const { useOverdraftStore } = createOverdraftStore(repo);

    await expect(useOverdraftStore.getState().logInterest(MOVEMENT)).rejects.toThrow('transaction aborted');
  });

  it('deletes an event through the repository, which cascades to a linked expense (criterion 6)', async () => {
    const { repo } = createMockRepo();
    const { useOverdraftStore } = createOverdraftStore(repo);

    await useOverdraftStore.getState().deleteEvent('e-9');

    expect(repo.deleteEvent).toHaveBeenCalledWith('e-9');
  });

  it('edits the line settings without creating any event (criterion 15)', async () => {
    const { repo } = createMockRepo();
    const { useOverdraftStore } = createOverdraftStore(repo);

    await useOverdraftStore.getState().updateLine({ monthlyRate: 2.1, plannedMonthlyPayment: 350000 });

    expect(repo.updateLine).toHaveBeenCalledWith({ monthlyRate: 2.1, plannedMonthlyPayment: 350000 });
    expect(repo.logDraw).not.toHaveBeenCalled();
    expect(repo.logPayment).not.toHaveBeenCalled();
    expect(repo.logCharge).not.toHaveBeenCalled();
  });
});
