import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { availableOf, creditCardBalance, creditCardStatus, usedPercent } from '../creditCards/creditCardMath';
import { useCreditCardsStore } from '../creditCards/store';
import type { CreditCard } from '../creditCards/types';
import { revolvingPayoff } from '../finance/revolvingPayoff';
import { validatePaymentAmount } from '../debts/validatePaymentAmount';
import { useTransactionsStore } from '../transactions/store';
import { validateAmount } from '../transactions/validateAmount';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Mode = 'closed' | 'add' | 'settings' | 'payment';

function formatCLP(amount: number): string {
  return `$${Math.abs(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function statusColor(status: ReturnType<typeof creditCardStatus>): string {
  return status === 'over-limit' ? colors.status.critical.text : colors.status.warning.text;
}

function payoffSentence(balance: number, monthlyRate: number | null, minimumPayment: number): string {
  const payoff = revolvingPayoff(balance, monthlyRate, minimumPayment);
  switch (payoff.kind) {
    case 'done':
      return 'Paid off.';
    case 'no-plan':
      return 'Set a minimum payment to see when it clears.';
    case 'not-covering':
      return "The minimum payment doesn't cover the interest — the balance won't shrink.";
    case 'at-least':
      return `Clears in at least ${payoff.months} ${payoff.months === 1 ? 'month' : 'months'} at the minimum payment, not counting interest.`;
    default:
      return `Clears in about ${payoff.months} ${payoff.months === 1 ? 'month' : 'months'} at the minimum payment, paying ≈ ${formatCLP(payoff.remainingInterest)} more in interest.`;
  }
}

// Content-only — no Screen wrapper, no own scroll region. Composed by
// ManageScreen alongside Categories/Budgets/Debts (spec 013, following
// spec 009's 2026-09-23 amendment pattern). A card's balance is a live
// derivation over transactions + payments (see creditCardMath), not a
// stored figure — nothing here writes a balance directly.
export function CreditCardsPanel() {
  const cards = useCreditCardsStore((s) => s.cards);
  const payments = useCreditCardsStore((s) => s.payments);
  const addCard = useCreditCardsStore((s) => s.addCard);
  const updateCard = useCreditCardsStore((s) => s.updateCard);
  const deleteCard = useCreditCardsStore((s) => s.deleteCard);
  const logPayment = useCreditCardsStore((s) => s.logPayment);
  const transactions = useTransactionsStore((s) => s.transactions);

  const [mode, setMode] = useState<Mode>('closed');
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [limitText, setLimitText] = useState('');
  const [minimumPaymentText, setMinimumPaymentText] = useState('');
  const [rateText, setRateText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [amountText, setAmountText] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);

  function openAddForm() {
    setActiveCardId(null);
    setName('');
    setLimitText('');
    setMinimumPaymentText('');
    setRateText('');
    setFormError(null);
    setMode('add');
  }

  function openSettingsForm(card: CreditCard) {
    setActiveCardId(card.id);
    setName(card.name);
    setLimitText(String(card.limit));
    setMinimumPaymentText(String(card.minimumPayment));
    setRateText(card.monthlyRate === null ? '' : String(card.monthlyRate));
    setFormError(null);
    setMode('settings');
  }

  function openPaymentForm(cardId: string) {
    setActiveCardId(cardId);
    setAmountText('');
    setAmountError(null);
    setMode('payment');
  }

  function closeForms() {
    setMode('closed');
    setActiveCardId(null);
  }

  function readCardForm() {
    if (name.trim() === '') {
      setFormError('Enter a name.');
      return null;
    }
    const limit = validateAmount(limitText);
    if (!limit.ok) {
      setFormError(limit.error);
      return null;
    }
    const minimumPayment = validateAmount(minimumPaymentText);
    if (!minimumPayment.ok) {
      setFormError(minimumPayment.error);
      return null;
    }
    const rateRaw = rateText.trim();
    if (rateRaw !== '' && !/^\d+(\.\d+)?$/.test(rateRaw)) {
      setFormError('Enter a monthly rate, like 3.45.');
      return null;
    }
    setFormError(null);
    return {
      name: name.trim(),
      limit: limit.value,
      minimumPayment: minimumPayment.value,
      monthlyRate: rateRaw === '' ? null : Number(rateRaw),
    };
  }

  async function handleSaveCard() {
    const values = readCardForm();
    if (!values) {
      return;
    }
    if (activeCardId) {
      await updateCard(activeCardId, values);
    } else {
      await addCard(values);
    }
    closeForms();
  }

  async function handleConfirmPayment() {
    if (!activeCardId) {
      return;
    }
    const balance = creditCardBalance(activeCardId, transactions, payments);
    const result = validatePaymentAmount(amountText, balance);
    if (!result.ok) {
      setAmountError(result.error);
      return;
    }
    await logPayment({ cardId: activeCardId, amount: result.value, date: new Date() });
    closeForms();
  }

  return (
    <View testID="credit-cards-panel">
      <View style={styles.header}>
        <Text style={styles.title}>Credit Cards</Text>
        {mode === 'closed' && <Button title="Add" onPress={openAddForm} testID="add-card-button" />}
      </View>

      {(mode === 'add' || mode === 'settings') && (
        <View style={styles.form} testID="card-form">
          <Input label="Name" value={name} onChangeText={setName} testID="card-name-input" />
          <Input
            label="Limit (CLP)"
            value={limitText}
            onChangeText={setLimitText}
            testID="card-limit-input"
            keyboardType="number-pad"
          />
          <Input
            label="Minimum payment (CLP)"
            value={minimumPaymentText}
            onChangeText={setMinimumPaymentText}
            testID="card-minimum-payment-input"
            keyboardType="number-pad"
          />
          <Input
            label="Monthly rate, % (optional)"
            value={rateText}
            onChangeText={setRateText}
            testID="card-rate-input"
            keyboardType="decimal-pad"
          />
          {formError && (
            <Text style={styles.errorText} testID="card-form-error">
              {formError}
            </Text>
          )}
          <Button title="Save" onPress={handleSaveCard} testID="save-card-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForms} testID="cancel-card-button" />
        </View>
      )}

      {mode === 'payment' && (
        <View style={styles.form} testID="card-payment-form">
          <Input
            label="Payment amount (CLP)"
            value={amountText}
            onChangeText={(text) => {
              setAmountText(text);
              setAmountError(null);
            }}
            testID="card-payment-amount-input"
            keyboardType="number-pad"
            error={amountError}
          />
          <Button title="Confirm payment" onPress={handleConfirmPayment} testID="confirm-card-payment-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForms} testID="cancel-card-payment-button" />
        </View>
      )}

      {mode === 'closed' && cards.length === 0 && (
        <View style={styles.emptyState} testID="credit-cards-empty-state">
          <Text style={styles.emptyStateText}>No credit cards tracked yet — tap Add to track one.</Text>
        </View>
      )}

      {mode === 'closed' &&
        cards.map((card) => {
          const balance = creditCardBalance(card.id, transactions, payments);
          const status = creditCardStatus(balance, card.limit);
          const showBadge = status !== 'in-use';
          return (
            <View key={card.id} testID={`card-row-${card.id}`} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowName}>{card.name}</Text>
                {showBadge && (
                  <View testID={`card-status-${card.id}`} style={styles.statusPill}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
                    <Text style={styles.statusLabel}>{status === 'over-limit' ? 'Over limit' : 'High'}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.rowDetail}>{formatCLP(balance)}</Text>
              <Text style={styles.rowSubDetail}>
                {`of ${formatCLP(card.limit)} limit · ${usedPercent(balance, card.limit)}% used · ${formatCLP(
                  availableOf(balance, card.limit)
                )} available`}
              </Text>
              <Text style={styles.rowSubDetail}>{payoffSentence(balance, card.monthlyRate, card.minimumPayment)}</Text>
              <View style={styles.rowActions}>
                <Pressable
                  testID={`log-card-payment-button-${card.id}`}
                  onPress={() => openPaymentForm(card.id)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionLabel}>Log payment</Text>
                </Pressable>
                <Pressable
                  testID={`edit-card-button-${card.id}`}
                  onPress={() => openSettingsForm(card)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionLabel}>Edit</Text>
                </Pressable>
                <Pressable
                  testID={`delete-card-${card.id}`}
                  onPress={() => deleteCard(card.id)}
                  style={styles.actionButton}
                >
                  <Text style={styles.actionLabel}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontFamily: typography.display, fontSize: typography.size.lg, color: colors.ink },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  spacer: { height: spacing.sm },
  errorText: { fontFamily: typography.body, fontSize: typography.size.sm, color: colors.status.critical.text, marginBottom: spacing.sm },
  emptyState: { paddingVertical: spacing.md },
  emptyStateText: { fontFamily: typography.body, fontSize: typography.size.base, color: colors.inkSecondary },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { fontFamily: typography.bodyBold, fontSize: typography.size.base, color: colors.ink },
  rowDetail: { fontFamily: typography.display, fontSize: typography.size.xl, color: colors.ink },
  rowSubDetail: { fontFamily: typography.body, fontSize: typography.size.sm, color: colors.inkSecondary },
  rowActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  actionLabel: { fontFamily: typography.bodyBold, fontSize: typography.size.sm + 1, color: colors.accent },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontFamily: typography.bodyBold, fontSize: typography.size.xs, color: colors.ink },
});
