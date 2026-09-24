import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Category } from '../../transactions/types';
import { useTransactionsStore } from '../../transactions/store';
import { CategoriesPanel } from '../CategoriesPanel';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));

function mockStore(overrides: Partial<Record<string, unknown>> = {}) {
  const state = {
    categories: [] as Category[],
    addCategory: jest.fn(),
    deleteCategory: jest.fn(),
    ...overrides,
  };
  (useTransactionsStore as unknown as jest.Mock).mockImplementation(
    (selector: (s: typeof state) => unknown) => selector(state)
  );
  return state;
}

const CUSTOM: Category = { id: 'cat-1', name: 'Pets', type: 'both' };

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

  it('creates a new custom category (criterion 6)', async () => {
    const store = mockStore();
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('add-category-button'));
    await fireEvent.changeText(screen.getByTestId('new-category-name-input'), 'Pets');
    await fireEvent.press(screen.getByTestId('confirm-add-category-button'));

    expect(store.addCategory).toHaveBeenCalledWith('Pets', 'both');
  });

  it('deletes a custom category (criterion 9)', async () => {
    const store = mockStore({ categories: [CUSTOM] });
    await render(<CategoriesPanel />);

    await fireEvent.press(screen.getByTestId('delete-category-cat-1'));

    expect(store.deleteCategory).toHaveBeenCalledWith('cat-1');
  });
});
