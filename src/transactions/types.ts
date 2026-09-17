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
};

/** users/{uid}/transactions — real-time via `subscribe`, matching the
 * store's dependence on Firestore listeners rather than one-shot fetches. */
export interface TransactionRepository {
  subscribe(callback: (transactions: Transaction[]) => void): () => void;
  create(input: NewTransactionInput): Promise<Transaction>;
  update(id: string, input: UpdateTransactionInput): Promise<void>;
  delete(id: string): Promise<void>;
}

/** users/{uid}/categories — custom categories only; the starter set is a
 * static app constant, not stored. */
export interface CategoryRepository {
  subscribe(callback: (categories: Category[]) => void): () => void;
  create(name: string, type: CategoryType): Promise<Category>;
}
