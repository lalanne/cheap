import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { useDebtsStore } from '../debts/store';
import type { Debt } from '../debts/types';
import { validatePaymentAmount } from '../debts/validatePaymentAmount';
import { percentPaid } from '../debts/payoffMath';
import { validateAmount } from '../transactions/validateAmount';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Mode = 'closed' | 'add' | 'payment' | 'balance';

function formatCLP(amount: number): string {
  return `$${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function DebtsScreen() {
  const debts = useDebtsStore((s) => s.debts);
  const addDebt = useDebtsStore((s) => s.addDebt);
  const logPayment = useDebtsStore((s) => s.logPayment);
  const editBalance = useDebtsStore((s) => s.editBalance);
  const deleteDebt = useDebtsStore((s) => s.deleteDebt);

  const [mode, setMode] = useState<Mode>('closed');
  const [activeDebtId, setActiveDebtId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [originalAmountText, setOriginalAmountText] = useState('');
  const [balanceText, setBalanceText] = useState('');
  const [minimumPaymentText, setMinimumPaymentText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  function openAddForm() {
    setName('');
    setOriginalAmountText('');
    setBalanceText('');
    setMinimumPaymentText('');
    setFormError(null);
    setMode('add');
  }

  function openPaymentForm(id: string) {
    setActiveDebtId(id);
    setAmountText('');
    setAmountError(null);
    setMode('payment');
  }

  function openBalanceForm(id: string) {
    setActiveDebtId(id);
    setAmountText('');
    setAmountError(null);
    setMode('balance');
  }

  function closeForms() {
    setMode('closed');
    setActiveDebtId(null);
  }

  async function handleSaveDebt() {
    if (name.trim() === '') {
      setFormError('Enter a name.');
      return;
    }
    const original = validateAmount(originalAmountText);
    if (!original.ok) {
      setFormError(original.error);
      return;
    }
    const balance = validateAmount(balanceText);
    if (!balance.ok) {
      setFormError(balance.error);
      return;
    }
    const minimumPayment = validateAmount(minimumPaymentText);
    if (!minimumPayment.ok) {
      setFormError(minimumPayment.error);
      return;
    }
    setFormError(null);
    await addDebt({
      name: name.trim(),
      originalAmount: original.value,
      currentBalance: balance.value,
      minimumPayment: minimumPayment.value,
      interestRate: null,
    });
    closeForms();
  }

  async function handleConfirmPayment() {
    const debt = debts.find((d) => d.id === activeDebtId);
    if (!debt || !activeDebtId) {
      return;
    }
    const result = validatePaymentAmount(amountText, debt.currentBalance);
    if (!result.ok) {
      setAmountError(result.error);
      return;
    }
    await logPayment(activeDebtId, result.value);
    closeForms();
  }

  async function handleConfirmBalance() {
    if (!activeDebtId) {
      return;
    }
    const result = validateAmount(amountText);
    if (!result.ok) {
      setAmountError(result.error);
      return;
    }
    await editBalance(activeDebtId, result.value);
    closeForms();
  }

  return (
    <Screen testID="debts-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Debts</Text>
        {mode === 'closed' && <Button title="Add" onPress={openAddForm} testID="add-debt-button" />}
      </View>

      {mode === 'add' && (
        <View style={styles.form} testID="debt-form">
          <Input label="Name" value={name} onChangeText={setName} testID="debt-name-input" />
          <Input
            label="Original amount (CLP)"
            value={originalAmountText}
            onChangeText={setOriginalAmountText}
            testID="debt-original-amount-input"
            keyboardType="number-pad"
          />
          <Input
            label="Current balance (CLP)"
            value={balanceText}
            onChangeText={setBalanceText}
            testID="debt-balance-input"
            keyboardType="number-pad"
          />
          <Input
            label="Minimum payment (CLP)"
            value={minimumPaymentText}
            onChangeText={setMinimumPaymentText}
            testID="debt-minimum-payment-input"
            keyboardType="number-pad"
          />
          {formError && (
            <Text style={styles.errorText} testID="debt-form-error">
              {formError}
            </Text>
          )}
          <Button title="Save" onPress={handleSaveDebt} testID="save-debt-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForms} testID="cancel-debt-button" />
        </View>
      )}

      {mode === 'payment' && (
        <View style={styles.form} testID="payment-form">
          <Input
            label="Payment amount (CLP)"
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              setAmountError(null);
            }}
            testID="payment-amount-input"
            keyboardType="number-pad"
            error={amountError}
          />
          <Button title="Confirm payment" onPress={handleConfirmPayment} testID="confirm-payment-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForms} testID="cancel-payment-button" />
        </View>
      )}

      {mode === 'balance' && (
        <View style={styles.form} testID="balance-form">
          <Input
            label="Current balance (CLP)"
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              setAmountError(null);
            }}
            testID="balance-amount-input"
            keyboardType="number-pad"
            error={amountError}
          />
          <Button title="Save balance" onPress={handleConfirmBalance} testID="confirm-balance-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForms} testID="cancel-balance-button" />
        </View>
      )}

      {mode === 'closed' && debts.length === 0 && (
        <View style={styles.emptyState} testID="debts-empty-state">
          <Text style={styles.emptyStateText}>No debts tracked yet — tap Add to track one.</Text>
        </View>
      )}

      {mode === 'closed' &&
        debts.map((debt: Debt) => {
          const paidOff = debt.currentBalance <= 0;
          return (
            <View key={debt.id} testID={`debt-row-${debt.id}`} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{debt.name}</Text>
                <Text style={styles.rowDetail}>
                  {paidOff
                    ? 'Paid off'
                    : `${formatCLP(debt.currentBalance)} of ${formatCLP(debt.originalAmount)} · ${Math.round(
                        percentPaid(debt.originalAmount, debt.currentBalance) * 100
                      )}% paid`}
                </Text>
              </View>
              <View style={styles.rowActions}>
                {!paidOff && (
                  <Pressable
                    testID={`log-payment-button-${debt.id}`}
                    onPress={() => openPaymentForm(debt.id)}
                    style={styles.actionButton}
                  >
                    <Text style={styles.actionLabel}>Log payment</Text>
                  </Pressable>
                )}
                <Pressable
                  testID={`edit-balance-button-${debt.id}`}
                  onPress={() => openBalanceForm(debt.id)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionLabel}>Edit</Text>
                </Pressable>
                <Pressable
                  testID={`delete-debt-${debt.id}`}
                  onPress={() => deleteDebt(debt.id)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionLabel}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
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
  errorText: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.ink,
    marginBottom: spacing.sm,
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
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  rowMain: {
    marginBottom: spacing.xs,
  },
  rowName: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  rowDetail: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    paddingVertical: spacing.xs,
  },
  actionLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs,
    color: colors.accent,
  },
});
