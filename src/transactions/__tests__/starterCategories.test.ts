import { STARTER_CATEGORIES } from '../starterCategories';

describe('starter categories (spec 008 criterion 10, issue #74)', () => {
  it('includes the built-in "Debt" parent category', () => {
    expect(STARTER_CATEGORIES).toContain('Debt');
  });
});
