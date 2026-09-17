// Static app constant — never stored in Firestore. Custom categories (spec
// 002, criterion 6) live in users/{uid}/categories instead.
export const STARTER_CATEGORIES: readonly string[] = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Health',
  'Shopping',
  'Income',
  'Other',
];
