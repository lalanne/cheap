import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { STARTER_CATEGORIES } from '../transactions/starterCategories';
import { useTransactionsStore } from '../transactions/store';
import type { Transaction, TransactionType } from '../transactions/types';
import { validateAmount } from '../transactions/validateAmount';
import { colors, radius, spacing, typography } from '../theme/tokens';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCLP(amount: number): string {
  return `$${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function TransactionsScreen() {
  const transactions = useTransactionsStore((s) => s.transactions);
  const categories = useTransactionsStore((s) => s.categories);
  const addTransaction = useTransactionsStore((s) => s.addTransaction);
  const updateTransaction = useTransactionsStore((s) => s.updateTransaction);
  const deleteTransaction = useTransactionsStore((s) => s.deleteTransaction);
  const addCategory = useTransactionsStore((s) => s.addCategory);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<string>(STARTER_CATEGORIES[0]);
  const [dateText, setDateText] = useState(todayIso());
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const allCategoryNames = [...STARTER_CATEGORIES, ...categories.map((c) => c.name)];

  function openAddForm() {
    setEditingId(null);
    setType('expense');
    setAmountText('');
    setCategory(STARTER_CATEGORIES[0]);
    setDateText(todayIso());
    setNote('');
    setAmountError(null);
    setAddingCategory(false);
    setFormOpen(true);
  }

  function openEditForm(tx: Transaction) {
    setEditingId(tx.id);
    setType(tx.type);
    setAmountText(String(tx.amount));
    setCategory(tx.category);
    setDateText(formatDate(tx.date));
    setNote(tx.note ?? '');
    setAmountError(null);
    setAddingCategory(false);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  async function handleSave() {
    const result = validateAmount(amountText);
    if (!result.ok) {
      setAmountError(result.error);
      return;
    }
    const payload = {
      type,
      amount: result.value,
      category,
      date: new Date(dateText),
      note: note.trim() === '' ? null : note.trim(),
    };
    if (editingId) {
      await updateTransaction(editingId, payload);
    } else {
      await addTransaction(payload);
    }
    closeForm();
  }

  async function handleConfirmAddCategory() {
    const name = newCategoryName.trim();
    if (name === '') {
      return;
    }
    const created = await addCategory(name, 'both');
    setCategory(created.name);
    setNewCategoryName('');
    setAddingCategory(false);
  }

  return (
    <View style={styles.container} testID="transactions-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        {!formOpen && (
          <Button title="Add" onPress={openAddForm} testID="add-transaction-button" />
        )}
      </View>

      {formOpen && (
        <View style={styles.form} testID="transaction-form">
          <View style={styles.tabs}>
            <Pressable testID="type-expense" style={styles.tab} onPress={() => setType('expense')}>
              <Text style={type === 'expense' ? styles.tabLabelActive : styles.tabLabel}>Expense</Text>
            </Pressable>
            <Pressable testID="type-income" style={styles.tab} onPress={() => setType('income')}>
              <Text style={type === 'income' ? styles.tabLabelActive : styles.tabLabel}>Income</Text>
            </Pressable>
          </View>

          <Input
            label="Amount (CLP)"
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              setAmountError(null);
            }}
            testID="amount-input"
            keyboardType="number-pad"
            error={amountError}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {allCategoryNames.map((name) => (
              <Pressable
                key={name}
                testID={`category-chip-${name}`}
                style={category === name ? styles.chipActive : styles.chip}
                onPress={() => setCategory(name)}
              >
                <Text style={category === name ? styles.chipLabelActive : styles.chipLabel}>
                  {name}
                </Text>
              </Pressable>
            ))}
            {!addingCategory && (
              <Pressable
                testID="add-category-button"
                style={styles.chip}
                onPress={() => setAddingCategory(true)}
              >
                <Text style={styles.chipLabel}>+ New</Text>
              </Pressable>
            )}
          </View>

          {addingCategory && (
            <View style={styles.newCategoryRow}>
              <View style={styles.newCategoryInput}>
                <Input
                  label="New category name"
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  testID="new-category-input"
                />
              </View>
              <Button
                title="Add"
                onPress={handleConfirmAddCategory}
                testID="confirm-add-category-button"
              />
            </View>
          )}

          <Input label="Date" value={dateText} onChangeText={setDateText} testID="date-input" />
          <Input label="Note (optional)" value={note} onChangeText={setNote} testID="note-input" />

          <Button title="Save" onPress={handleSave} testID="save-transaction-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForm} testID="cancel-transaction-button" />
        </View>
      )}

      {!formOpen &&
        transactions.map((tx) => (
          <Pressable
            key={tx.id}
            testID={`transaction-row-${tx.id}`}
            style={styles.row}
            onPress={() => openEditForm(tx)}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowCategory}>{tx.category}</Text>
              <Text style={styles.rowDate}>
                {formatDate(tx.date)}
                {tx.note ? ` · ${tx.note}` : ''}
              </Text>
            </View>
            <Text style={tx.type === 'income' ? styles.rowAmountIncome : styles.rowAmountExpense}>
              {tx.type === 'income' ? '+' : '−'}
              {formatCLP(tx.amount)}
            </Text>
            <Pressable
              testID={`delete-transaction-${tx.id}`}
              onPress={() => deleteTransaction(tx.id)}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.input,
    padding: spacing.xs / 2,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.input - 2,
  },
  tabLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
  },
  tabLabelActive: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.ink,
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
  newCategoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  newCategoryInput: {
    flex: 1,
  },
  spacer: {
    height: spacing.sm,
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
  rowDate: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
  rowAmountExpense: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.ink,
  },
  rowAmountIncome: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.success,
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
