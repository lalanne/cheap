import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { DatePickerField } from '../components/DatePickerField';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { VersionStamp } from '../components/VersionStamp';
import { groupTransactionsByMonth } from '../transactions/groupByMonth';
import { STARTER_CATEGORIES } from '../transactions/starterCategories';
import { useTransactionsStore } from '../transactions/store';
import type { Transaction, TransactionType } from '../transactions/types';
import { validateAmount } from '../transactions/validateAmount';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { useWideWeb } from '../theme/useWideWeb';

const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatCLP(amount: number): string {
  return `$${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// Local date parts, not toISOString() (UTC) — matches the local-date
// convention DatePickerField.web.tsx already established. Short form:
// once a transaction sits under its month's header (2026-09-25
// amendment), repeating the full year on every row is redundant.
function formatDate(date: Date): string {
  return `${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export function TransactionsScreen() {
  const isWideWeb = useWideWeb();
  const transactions = useTransactionsStore((s) => s.transactions);
  const categories = useTransactionsStore((s) => s.categories);
  const addTransaction = useTransactionsStore((s) => s.addTransaction);
  const updateTransaction = useTransactionsStore((s) => s.updateTransaction);
  const deleteTransaction = useTransactionsStore((s) => s.deleteTransaction);
  const addCategory = useTransactionsStore((s) => s.addCategory);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Spec 006's 2026-09-25 amendment — which month the wide-web rail has
  // selected; null means "default to the most recent month with data."
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const [type, setType] = useState<TransactionType>('expense');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<string>(STARTER_CATEGORIES[0]);
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const allCategoryNames = [...STARTER_CATEGORIES, ...categories.map((c) => c.name)];

  function openAddForm() {
    setEditingId(null);
    setType('expense');
    setAmountText('');
    setCategory(STARTER_CATEGORIES[0]);
    setDate(new Date());
    setNote('');
    setAmountError(null);
    setSaveError(null);
    setAddingCategory(false);
    setFormOpen(true);
  }

  function openEditForm(tx: Transaction) {
    setEditingId(tx.id);
    setType(tx.type);
    setAmountText(String(tx.amount));
    setCategory(tx.category);
    setDate(tx.date);
    setNote(tx.note ?? '');
    setAmountError(null);
    setSaveError(null);
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
    setSaveError(null);
    const payload = {
      type,
      amount: result.value,
      category,
      date,
      note: note.trim() === '' ? null : note.trim(),
    };
    try {
      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await addTransaction(payload);
      }
      closeForm();
    } catch (e) {
      setSaveError((e as { message?: string }).message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleConfirmAddCategory() {
    const name = newCategoryName.trim();
    if (name === '') {
      return;
    }
    // Quick-add-while-logging always creates a top-level category — the
    // parent picker lives in the Manage tab's Categories panel (spec 011).
    const created = await addCategory(name, 'both', null);
    setCategory(created.name);
    setNewCategoryName('');
    setAddingCategory(false);
  }

  const typeToggle = (
    <View style={styles.tabs}>
      <Pressable
        testID="type-expense"
        style={type === 'expense' ? styles.tabActive : styles.tab}
        onPress={() => setType('expense')}
      >
        <Text style={type === 'expense' ? styles.tabLabelActive : styles.tabLabel}>Expense</Text>
      </Pressable>
      <Pressable
        testID="type-income"
        style={type === 'income' ? styles.tabActive : styles.tab}
        onPress={() => setType('income')}
      >
        <Text style={type === 'income' ? styles.tabLabelActive : styles.tabLabel}>Income</Text>
      </Pressable>
    </View>
  );

  const amountField = (
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
  );

  const dateField = <DatePickerField label="Date" value={date} onChange={setDate} testID="date-input" />;

  const categorySection = (
    <>
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {allCategoryNames.map((name) => (
          <Pressable
            key={name}
            testID={`category-chip-${name}`}
            style={category === name ? styles.chipActive : styles.chip}
            onPress={() => setCategory(name)}
          >
            <Text style={category === name ? styles.chipLabelActive : styles.chipLabel}>{name}</Text>
          </Pressable>
        ))}
        {!addingCategory && (
          <Pressable testID="add-category-button" style={styles.chip} onPress={() => setAddingCategory(true)}>
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
          <Button title="Add" onPress={handleConfirmAddCategory} testID="confirm-add-category-button" />
        </View>
      )}
    </>
  );

  const noteAndActions = (
    <>
      <Input label="Note (optional)" value={note} onChangeText={setNote} testID="note-input" />

      {saveError && (
        <Text style={styles.saveError} testID="save-error">
          {saveError}
        </Text>
      )}
      <Button title="Save" onPress={handleSave} testID="save-transaction-button" />
      <View style={styles.spacer} />
      <Button title="Cancel" onPress={closeForm} testID="cancel-transaction-button" />
    </>
  );

  function renderTransactionRow(tx: Transaction) {
    return (
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
    );
  }

  // Spec 002's 2026-09-25 amendment — grouped by calendar month, most
  // recent first (groupTransactionsByMonth relies on `transactions`
  // already being date-descending, criterion 5). Shared by both the
  // narrow sticky list and the wide-web rail (spec 006's 2026-09-25
  // amendment) — one grouping implementation, two renderings.
  const monthGroups = groupTransactionsByMonth(transactions);

  // Narrow/native: each month's own sticky header carries its own Add
  // button now (criterion 14) — no page-level button. Empty state below
  // covers the zero-transactions case, the one place a page-level Add
  // still exists (criterion 15).
  const narrowRows = monthGroups.map((group) => (
    <View key={`${group.year}-${group.month}`}>
      <View
        testID={`transaction-month-header-${group.year}-${group.month}`}
        style={[styles.monthHeader, Platform.OS === 'web' && styles.monthHeaderSticky]}
      >
        <View>
          <Text style={styles.monthHeaderName}>
            {FULL_MONTH_NAMES[group.month - 1]} {group.year}
          </Text>
          <Text style={styles.monthHeaderSpent}>Spent {formatCLP(group.totalSpent)}</Text>
        </View>
        <Pressable
          testID={`add-transaction-button-${group.year}-${group.month}`}
          onPress={openAddForm}
          style={styles.monthAddButton}
        >
          <Text style={styles.monthAddButtonLabel}>+</Text>
        </Pressable>
      </View>
      {group.transactions.map(renderTransactionRow)}
    </View>
  ));

  // Wide web: a month rail (spec 006's 2026-09-25 amendment) selects
  // which month's rows the middle column shows, defaulting to the most
  // recent when nothing's been clicked.
  const selectedGroup =
    monthGroups.find((g) => selectedMonth && g.year === selectedMonth.year && g.month === selectedMonth.month) ??
    monthGroups[0] ??
    null;

  const monthRail = (
    <View style={styles.monthRail} testID="month-rail">
      {monthGroups.map((group) => {
        const isSelected = selectedGroup?.year === group.year && selectedGroup?.month === group.month;
        return (
          <Pressable
            key={`${group.year}-${group.month}`}
            testID={`month-rail-item-${group.year}-${group.month}`}
            style={isSelected ? styles.monthRailItemActive : styles.monthRailItem}
            onPress={() => setSelectedMonth({ year: group.year, month: group.month })}
          >
            <Text style={isSelected ? styles.monthRailNameActive : styles.monthRailName}>
              {FULL_MONTH_NAMES[group.month - 1]} {group.year}
            </Text>
            <Text style={isSelected ? styles.monthRailSpentActive : styles.monthRailSpent}>
              {formatCLP(group.totalSpent)} spent
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const monthColumn = (
    <View style={styles.wideListColumn} testID="month-column">
      {selectedGroup ? (
        <>
          <View style={styles.wideMonthHeader}>
            <Text style={styles.monthHeaderName}>
              {FULL_MONTH_NAMES[selectedGroup.month - 1]} {selectedGroup.year}
            </Text>
            <Button title="Add transaction" onPress={openAddForm} testID="add-transaction-button" />
          </View>
          {selectedGroup.transactions.map(renderTransactionRow)}
        </>
      ) : (
        <View style={styles.wideMonthHeader}>
          <Text style={styles.wideEmptyStateText}>No transactions yet.</Text>
          <Button title="Add transaction" onPress={openAddForm} testID="add-transaction-button" />
        </View>
      )}
    </View>
  );

  return (
    <Screen testID="transactions-screen" wide={isWideWeb}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
      </View>

      {isWideWeb ? (
        <View style={styles.wideLayout} testID="wide-layout">
          {monthRail}
          {monthColumn}
          <View style={styles.wideFormColumn}>
            {formOpen ? (
              <View style={styles.form} testID="transaction-form">
                {typeToggle}
                <View style={styles.amountDateRow} testID="amount-date-row">
                  <View style={styles.amountDateCell}>{amountField}</View>
                  <View style={styles.amountDateCell}>{dateField}</View>
                </View>
                {categorySection}
                {noteAndActions}
              </View>
            ) : (
              <View style={styles.wideEmptyState} testID="wide-empty-state">
                <Text style={styles.wideEmptyStateText}>Select Add, or a transaction, to see it here.</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <>
          {formOpen && (
            <View style={styles.form} testID="transaction-form">
              {typeToggle}
              {amountField}
              {categorySection}
              {dateField}
              {noteAndActions}
            </View>
          )}
          {!formOpen && monthGroups.length > 0 && narrowRows}
          {!formOpen && monthGroups.length === 0 && (
            <View style={styles.narrowEmptyState} testID="narrow-empty-state">
              <Text style={styles.wideEmptyStateText}>No transactions yet.</Text>
              <Button title="Add" onPress={openAddForm} testID="add-transaction-button" />
            </View>
          )}
        </>
      )}

      <View style={styles.footer}>
        <VersionStamp />
      </View>
    </Screen>
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
  // Spec 006 — master-detail split, ≥900px only (see useWideWeb).
  // 2026-09-25 amendment: a third, narrower rail column joins the list
  // and form columns.
  wideLayout: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  monthRail: {
    width: 160,
    flexShrink: 0,
    gap: spacing.xs,
  },
  monthRailItem: {
    borderRadius: radius.card,
    padding: spacing.sm + 2,
  },
  monthRailItemActive: {
    borderRadius: radius.card,
    padding: spacing.sm + 2,
    backgroundColor: colors.accent,
  },
  monthRailName: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.ink,
  },
  monthRailNameActive: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.onAccent,
  },
  monthRailSpent: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
    marginTop: 2,
  },
  monthRailSpentActive: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.onAccent,
    marginTop: 2,
  },
  wideListColumn: {
    width: 340,
    flexShrink: 0,
  },
  wideMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
    gap: spacing.sm,
  },
  wideFormColumn: {
    flex: 1,
  },
  wideEmptyState: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideEmptyStateText: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkMuted,
  },
  narrowEmptyState: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  amountDateRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  amountDateCell: {
    flex: 1,
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
    backgroundColor: 'transparent',
  },
  tabActive: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.input - 2,
    backgroundColor: colors.accent,
  },
  tabLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
  },
  tabLabelActive: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.onAccent,
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
  saveError: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  // Web only (Platform.OS check at the call site) — React Native's style
  // system has no `position: 'sticky'`; react-native-web forwards it
  // straight through to real CSS.
  monthHeaderSticky: {
    position: 'sticky' as 'relative',
    top: 0,
    zIndex: 1,
  },
  monthHeaderName: {
    fontFamily: typography.display,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  monthHeaderSpent: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs,
    color: colors.inkSecondary,
  },
  monthAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthAddButtonLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.lg,
    color: colors.onAccent,
    lineHeight: typography.size.lg,
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
  footer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
});
