export type Debt = {
  id: string;
  name: string; // also used as the linked transaction's category
  originalAmount: number; // whole CLP, starting balance when first tracked
  currentBalance: number; // whole CLP, remaining balance
  minimumPayment: number; // whole CLP, monthly minimum payment
  interestRate: number | null; // optional annual %, not used in v1's payoff estimate
  createdAt: Date;
  updatedAt: Date;
};

export type NewDebtInput = {
  name: string;
  originalAmount: number;
  currentBalance: number;
  minimumPayment: number;
  interestRate?: number | null;
};

/** users/{uid}/debts — real-time via `subscribe`, matching every other
 * repository in this app. `logPayment` is the one exception to the
 * "one repository, one collection" rule: it atomically creates an
 * `expense` transaction in `users/{uid}/transactions` (category: the
 * debt's own name) *and* decreases the debt's balance — both succeed or
 * neither does (spec 008 criterion 2). `updateBalance` is the plain,
 * non-atomic correction path: it touches only the debt, no transaction. */
export interface DebtRepository {
  subscribe(callback: (debts: Debt[]) => void): () => void;
  create(input: NewDebtInput): Promise<Debt>;
  updateBalance(id: string, currentBalance: number): Promise<void>;
  logPayment(id: string, amount: number): Promise<void>;
  delete(id: string): Promise<void>;
}
