import { render, screen } from '@testing-library/react-native';

import { useBudgetsStore } from '../../budgets/store';
import { useCreditCardsStore } from '../../creditCards/store';
import { useDebtsStore } from '../../debts/store';
import { useTransactionsStore } from '../../transactions/store';
import { ManageScreen } from '../ManageScreen';

jest.mock('../../transactions/store', () => ({
  useTransactionsStore: jest.fn(),
}));
jest.mock('../../budgets/store', () => ({
  useBudgetsStore: jest.fn(),
}));
jest.mock('../../debts/store', () => ({
  useDebtsStore: jest.fn(),
}));
jest.mock('../../creditCards/store', () => ({
  useCreditCardsStore: jest.fn(),
}));
jest.mock('../../theme/useWideWeb', () => ({
  useWideWeb: () => true,
}));

describe('ManageScreen (wide web, spec 009 amendment criterion 10)', () => {
  it('groups Categories, Budgets, and Debts into a three-column wide row', async () => {
    (useTransactionsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { categories: never[]; addCategory: jest.Mock; deleteCategory: jest.Mock }) => unknown) =>
        selector({ categories: [], addCategory: jest.fn(), deleteCategory: jest.fn() })
    );
    (useBudgetsStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: { budgets: never[]; setBudget: jest.Mock; deleteBudget: jest.Mock }) => unknown) =>
        selector({ budgets: [], setBudget: jest.fn(), deleteBudget: jest.fn() })
    );
    (useDebtsStore as unknown as jest.Mock).mockImplementation(
      (
        selector: (s: {
          debts: never[];
          addDebt: jest.Mock;
          logPayment: jest.Mock;
          editBalance: jest.Mock;
          deleteDebt: jest.Mock;
        }) => unknown
      ) => selector({ debts: [], addDebt: jest.fn(), logPayment: jest.fn(), editBalance: jest.fn(), deleteDebt: jest.fn() })
    );
    (useCreditCardsStore as unknown as jest.Mock).mockImplementation(
      (
        selector: (s: {
          cards: never[];
          payments: never[];
          addCard: jest.Mock;
          updateCard: jest.Mock;
          deleteCard: jest.Mock;
          logPayment: jest.Mock;
          deletePayment: jest.Mock;
        }) => unknown
      ) =>
        selector({
          cards: [],
          payments: [],
          addCard: jest.fn(),
          updateCard: jest.fn(),
          deleteCard: jest.fn(),
          logPayment: jest.fn(),
          deletePayment: jest.fn(),
        })
    );

    await render(<ManageScreen />);

    expect(screen.getByTestId('manage-wide-row')).toBeTruthy();
    expect(screen.getByTestId('categories-panel')).toBeTruthy();
    expect(screen.getByTestId('budgets-panel')).toBeTruthy();
    expect(screen.getByTestId('debts-panel')).toBeTruthy();
    expect(screen.getByTestId('credit-cards-panel')).toBeTruthy();
  });
});
