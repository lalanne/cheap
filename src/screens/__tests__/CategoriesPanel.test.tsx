import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { Category } from '../../transactions/types';
import { useTransactionsStore } from '../../transactions/store';
import { useBudgetsStore } from '../../budgets/store';
import { CategoriesPanel } from '../CategoriesPanel';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));
jest.mock('../../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    categories: [] as Category[],
    addCategory: jest.fn(),
    deleteCategory: jest.fn(),
    updateCategory: jest.fn(),
    ...overrides,
  };
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
  return state;
}

function mockBudgetsStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    renameCategoryInBudgets: jest.fn(),
    ...overrides,
  };
  (useBudgetsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state),
  );
  return state;
}

const CUSTOM: Category = { id: 'cat-1', name: 'Pets', type: 'both', parentCategory: null };

describe('CategoriesPanel (spec 009 amendment: Manage tab, not its own screen)', () => {
  it('renders as a panel, not a top-level Screen', async () => {
    mockStore();
    await render(<CategoriesPanel />);

    expect(screen.getByTestId('categories-panel')).toBeTruthy();
  });

  it('lists starter categories without a delete option', async () => {
    mockStore();
    await render(<CategoriesPanel />);

    expect(screen.getByTestId('category-row-starter-Food')).toBeTruthy();
    expect(screen.queryByTestId('delete-category-starter-Food')).toBeNull();
  });

  it('lists custom categories with a delete option', async () => {
    mockStore({ categories: [CUSTOM] });
    await render(<CategoriesPanel />);

    expect(screen.getByTestId('category-row-cat-1')).toBeTruthy();
    expect(screen.getByTestId('delete-category-cat-1')).toBeTruthy();
  });

  it('creates a new top-level custom category (criterion 6)', async () => {
    const store = mockStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('add-category-button'));
    await fireEvent.changeText(screen.getByTestId('new-category-name-input'), 'Pets');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.addCategory).toHaveBeenCalledWith('Pets', 'both', null);
  });

  it('deletes a custom category (criterion 9)', async () => {
    const store = mockStore({ categories: [CUSTOM] });
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('delete-category-cat-1'));

    expect(store.deleteCategory).toHaveBeenCalledWith('cat-1');
  });
});

describe('CategoriesPanel (spec 011 — subcategories)', () => {
  it('creates a subcategory under a picked parent', async () => {
    const store = mockStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('add-category-button'));
    await fireEvent.changeText(screen.getByTestId('new-category-name-input'), 'Uber Eats');
    await fireEvent.press(screen.getByTestId('parent-category-chip-Food'));
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.addCategory).toHaveBeenCalledWith('Uber Eats', 'both', 'Food');
  });

  it('defaults the parent picker to None and resets it after a save', async () => {
    const store = mockStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('add-category-button'));
    expect(screen.getByTestId('parent-category-chip-None')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('new-category-name-input'), 'Pets');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.addCategory).toHaveBeenCalledWith('Pets', 'both', null);
  });

  it('nests a subcategory under a starter-category parent (criterion 2)', async () => {
    const subcategory: Category = {
      id: 'c1',
      name: 'Uber Eats',
      type: 'both',
      parentCategory: 'Food',
    };
    mockStore({ categories: [subcategory] });
    await render(<CategoriesPanel />);

    const group = within(screen.getByTestId('category-group-Food'));
    expect(group.getByTestId('category-row-starter-Food')).toBeTruthy();
    expect(group.getByTestId('category-row-c1')).toBeTruthy();
    expect(group.getByTestId('delete-category-c1')).toBeTruthy();
  });

  it('nests a subcategory under a custom top-level parent (criterion 2)', async () => {
    const parent: Category = { id: 'p1', name: 'Gym', type: 'both', parentCategory: null };
    const child: Category = { id: 'c2', name: 'Yoga Classes', type: 'both', parentCategory: 'Gym' };
    mockStore({ categories: [parent, child] });
    await render(<CategoriesPanel />);

    const group = within(screen.getByTestId('category-group-Gym'));
    expect(group.getByTestId('category-row-p1')).toBeTruthy();
    expect(group.getByTestId('category-row-c2')).toBeTruthy();
  });

  it('offers starter and top-level custom categories as parent options, not existing subcategories', async () => {
    const parent: Category = { id: 'p1', name: 'Gym', type: 'both', parentCategory: null };
    const child: Category = { id: 'c2', name: 'Yoga Classes', type: 'both', parentCategory: 'Gym' };
    mockStore({ categories: [parent, child] });
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('add-category-button'));

    expect(screen.getByTestId('parent-category-chip-Food')).toBeTruthy();
    expect(screen.getByTestId('parent-category-chip-Gym')).toBeTruthy();
    expect(screen.queryByTestId('parent-category-chip-Yoga Classes')).toBeNull();
  });
});

describe('CategoriesPanel — editing (spec 002 2026-09-24 amendment, criteria 10/11)', () => {
  it('opens an edit form pre-filled when tapping a custom category row, and saves a rename', async () => {
    const store = mockStore({ categories: [CUSTOM] });
    mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-cat-1'));

    expect(screen.getByTestId('new-category-name-input').props.value).toBe('Pets');

    await fireEvent.changeText(screen.getByTestId('new-category-name-input'), 'Dogs');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.updateCategory).toHaveBeenCalledWith('cat-1', 'Dogs', null, 'Pets');
  });

  it('cascades the rename to budgets when the name changed', async () => {
    mockStore({ categories: [CUSTOM] });
    const budgetsStore = mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-cat-1'));
    await fireEvent.changeText(screen.getByTestId('new-category-name-input'), 'Dogs');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(budgetsStore.renameCategoryInBudgets).toHaveBeenCalledWith('Pets', 'Dogs');
  });

  it('does not cascade a rename when only the parent changed', async () => {
    const parent: Category = { id: 'p1', name: 'Gym', type: 'both', parentCategory: null };
    mockStore({ categories: [parent] });
    const budgetsStore = mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-p1'));
    await fireEvent.press(screen.getByTestId('parent-category-chip-Food'));
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(budgetsStore.renameCategoryInBudgets).not.toHaveBeenCalled();
  });

  it('re-parents a top-level category with no children from the edit form', async () => {
    const groceries: Category = { id: 'g1', name: 'Groceries', type: 'both', parentCategory: null };
    const store = mockStore({ categories: [groceries] });
    mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-g1'));
    await fireEvent.press(screen.getByTestId('parent-category-chip-Food'));
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.updateCategory).toHaveBeenCalledWith('g1', 'Groceries', 'Food', 'Groceries');
  });

  it('offers no parent picker when editing a top-level category that has subcategories', async () => {
    const parent: Category = { id: 'p1', name: 'Gym', type: 'both', parentCategory: null };
    const child: Category = { id: 'c2', name: 'Yoga Classes', type: 'both', parentCategory: 'Gym' };
    mockStore({ categories: [parent, child] });
    mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-p1'));

    expect(screen.queryByTestId('parent-picker-section')).toBeNull();
  });

  it('always offers a parent picker (including None) when editing a subcategory', async () => {
    const parent: Category = { id: 'p1', name: 'Gym', type: 'both', parentCategory: null };
    const child: Category = { id: 'c2', name: 'Yoga Classes', type: 'both', parentCategory: 'Gym' };
    mockStore({ categories: [parent, child] });
    mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-c2'));

    expect(screen.getByTestId('parent-picker-section')).toBeTruthy();
    expect(screen.getByTestId('parent-category-chip-None')).toBeTruthy();
  });

  it('starter categories stay non-editable (no row press handler)', async () => {
    const store = mockStore();
    mockBudgetsStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('category-row-starter-Food'));

    expect(screen.queryByTestId('category-form')).toBeNull();
    expect(store.updateCategory).not.toHaveBeenCalled();
  });
});
