import type { Category } from '../transactions/types';
import { STARTER_CATEGORIES } from '../transactions/starterCategories';

// Spec 011 — a name is a valid roll-up target if it's a starter category
// or a current TOP-LEVEL custom category (parentCategory === null). A
// subcategory can never itself be a parent (one level of nesting only),
// so this deliberately doesn't check subcategory names.
function isValidParentName(name: string, categories: Category[]): boolean {
  if (STARTER_CATEGORIES.includes(name)) {
    return true;
  }
  return categories.some((c) => c.name === name && c.parentCategory === null);
}

// Folds each subcategory's total into its parent's and drops the
// subcategory's own key — the input to the dashboard's top-level donut
// ring. A subcategory whose parentCategory no longer resolves to any
// current category (its parent was deleted) stays as its own top-level
// entry instead of disappearing or being folded into a stale name.
export function rollUpCategoryTotals(
  totals: Record<string, number>,
  categories: Category[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [categoryName, amount] of Object.entries(totals)) {
    const category = categories.find((c) => c.name === categoryName);
    const parent = category?.parentCategory ?? null;
    const target = parent && isValidParentName(parent, categories) ? parent : categoryName;
    result[target] = (result[target] ?? 0) + amount;
  }
  return result;
}

// Spend lookup for budgets (spec 011 criterion 9): rolled-up totals, plus
// each valid subcategory's own unrolled total under its own name. A budget
// on a parent must see parent + children (criterion 8), but a budget on a
// subcategory must see that subcategory's own spend — rollUpCategoryTotals
// drops the subcategory key, so looking it up there gave $0 (#34, #35).
// A lookup table only, never summed: the donut keeps using
// rollUpCategoryTotals so nothing is counted twice.
export function budgetSpendTotals(
  totals: Record<string, number>,
  categories: Category[],
): Record<string, number> {
  const result = rollUpCategoryTotals(totals, categories);
  for (const [categoryName, amount] of Object.entries(totals)) {
    const parent = categories.find((c) => c.name === categoryName)?.parentCategory ?? null;
    if (parent && isValidParentName(parent, categories)) {
      result[categoryName] = amount;
    }
  }
  return result;
}

// Just the given parent's direct subcategories and their raw (unrolled)
// amounts — the input to the drilled-in donut ring.
export function subcategoryTotalsFor(
  totals: Record<string, number>,
  categories: Category[],
  parentName: string,
): Record<string, number> {
  const childNames = new Set(
    categories.filter((c) => c.parentCategory === parentName).map((c) => c.name),
  );
  const result: Record<string, number> = {};
  for (const [categoryName, amount] of Object.entries(totals)) {
    if (childNames.has(categoryName)) {
      result[categoryName] = amount;
    }
  }
  return result;
}
