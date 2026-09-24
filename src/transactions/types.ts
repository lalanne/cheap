export type TransactionType = 'expense' | 'income';

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number; // whole CLP, always positive
  category: string; // starter-set key, or a custom category id
  date: Date; // user-specified transaction date
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewTransactionInput = {
  type: TransactionType;
  amount: number;
  category: string;
  date: Date;
  note?: string | null;
};

export type UpdateTransactionInput = Partial<NewTransactionInput>;

export type CategoryType = TransactionType | 'both';

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  // Spec 011 — a starter category's name, or an existing top-level
  // custom category's name; null = top-level. One level of nesting
  // only (see spec 011's Decisions).
  parentCategory: string | null;
};

/** users/{uid}/transactions — real-time via `subscribe`, matching the
 * store's dependence on Firestore listeners rather than one-shot fetches. */
export interface TransactionRepository {
  subscribe(callback: (transactions: Transaction[]) => void): () => void;
  create(input: NewTransactionInput): Promise<Transaction>;
  update(id: string, input: UpdateTransactionInput): Promise<void>;
  delete(id: string): Promise<void>;
  // Spec 002's 2026-09-24 amendment — the one cascade a plain-string
  // category needs: a rename must not silently orphan every transaction
  // that already used the old name.
  renameCategoryInTransactions(oldName: string, newName: string): Promise<void>;
}

/** users/{uid}/categories — custom categories only; the starter set is a
 * static app constant, not stored, so there's never an id to delete for
 * one of those (spec 002's 2026-09-22 amendment). */
export interface CategoryRepository {
  subscribe(callback: (categories: Category[]) => void): () => void;
  // parentCategory required (pass null explicitly), not optional — spec
  // 011: every call site has to make the choice, not silently default.
  create(name: string, type: CategoryType, parentCategory: string | null): Promise<Category>;
  delete(id: string): Promise<void>;
  // Spec 002's 2026-09-24 amendment.
  update(id: string, name: string, parentCategory: string | null): Promise<void>;
}
