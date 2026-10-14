import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBudgetsStore } from '../budgets/store';
import type { Budget } from '../budgets/types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { STARTER_CATEGORIES } from '../transactions/starterCategories';
import { useTransactionsStore } from '../transactions/store';
import { validateAmount } from '../transactions/validateAmount';
import { colors, radius, spacing, typography } from '../theme/tokens';

function formatCLP(amount: number): string {
  return `$${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Content-only — no Screen wrapper, no own scroll region. Composed by
// ManageScreen alongside CategoriesPanel/DebtsPanel (spec 009's
// 2026-09-23 amendment); was a standalone top-level BudgetsScreen before.
export function BudgetsPanel() {
  const budgets = useBudgetsStore((s) => s.budgets);
  const setBudget = useBudgetsStore((s) => s.setBudget);
  const deleteBudget = useBudgetsStore((s) => s.deleteBudget);
  const categories = useTransactionsStore((s) => s.categories);

  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  const allCategoryNames = [...STARTER_CATEGORIES, ...categories.map((c) => c.name)];

  function openAddForm() {
    setCategory(null);
    setAmountText('');
    setAmountError(null);
    setFormOpen(true);
  }

  function openEditForm(budget: Budget) {
    setCategory(budget.category);
    setAmountText(String(budget.monthlyLimit));
    setAmountError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  async function handleSave() {
    if (!category) {
      setAmountError('Choose a category.');
      return;
    }
    const result = validateAmount(amountText);
    if (!result.ok) {
      setAmountError(result.error);
      return;
    }
    await setBudget(category, result.value);
    closeForm();
  }

  return (
    <View testID="budgets-panel">
      <View style={styles.header}>
        <Text style={styles.title}>Budgets</Text>
        {!formOpen && <Button title="Add" onPress={openAddForm} testID="add-budget-button" />}
      </View>

      {formOpen && (
        <View style={styles.form} testID="budget-form">
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {allCategoryNames.map((name) => (
              <Pressable
                key={name}
                testID={`budget-category-chip-${name}`}
                style={category === name ? styles.chipActive : styles.chip}
                onPress={() => setCategory(name)}
              >
                <Text style={category === name ? styles.chipLabelActive : styles.chipLabel}>
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Input
            label="Monthly limit (CLP)"
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              setAmountError(null);
            }}
            testID="budget-amount-input"
            keyboardType="number-pad"
            error={amountError}
          />

          <Button title="Save" onPress={handleSave} testID="save-budget-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForm} testID="cancel-budget-button" />
        </View>
      )}

      {!formOpen && budgets.length === 0 && (
        <View style={styles.emptyState} testID="budgets-empty-state">
          <Text style={styles.emptyStateText}>No budgets set yet — tap Add to set one.</Text>
        </View>
      )}

      {!formOpen &&
        budgets.map((budget) => (
          <Pressable
            key={budget.id}
            testID={`budget-row-${budget.id}`}
            style={styles.row}
            onPress={() => openEditForm(budget)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowCategory}>{budget.category}</Text>
              <Text style={styles.rowLimit}>{formatCLP(budget.monthlyLimit)} / month</Text>
            </View>
            <Pressable
              testID={`delete-budget-${budget.id}`}
              onPress={() => deleteBudget(budget.id)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteLabel}>Delete</Text>
            </Pressable>
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.display,
    fontSize: typography.size.xl,
    color: colors.ink,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
    marginBottom: spacing.xs + 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipLabel: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
  },
  chipLabelActive: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.onAccent,
  },
  spacer: {
    height: spacing.sm,
  },
  emptyState: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowMain: {
    flex: 1,
  },
  rowCategory: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  rowLimit: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
  deleteButton: {
    paddingHorizontal: spacing.xs + 2,
  },
  deleteLabel: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
});
