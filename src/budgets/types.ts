export type Budget = {
  id: string;
  category: string;
  monthlyLimit: number; // whole CLP, always positive
  createdAt: Date;
  updatedAt: Date;
};

/** users/{uid}/budgets — one document per category (enforced by the
 * store, not the repository: setBudget looks up an existing budget for
 * the category and updates it in place rather than creating a
 * duplicate). Real-time via `subscribe`, matching TransactionRepository. */
export interface BudgetRepository {
  subscribe(callback: (budgets: Budget[]) => void): () => void;
  create(category: string, monthlyLimit: number): Promise<Budget>;
  update(id: string, monthlyLimit: number): Promise<void>;
  delete(id: string): Promise<void>;
}
