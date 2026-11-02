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
  // Spec 008 (issue #74): parent of one subcategory per debt, so all debt
  // payments roll up into a single slice on the dashboard donut.
  'Debt',
  'Income',
  'Other',
];
