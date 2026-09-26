import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Button } from '../components/Button';
import { DatePickerField } from '../components/DatePickerField';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { StatusIcon } from '../components/StatusIcon';
import { formatCLP, formatShortDate } from '../overdraft/format';
import {
  availableOf,
  balanceHistory,
  balanceOf,
  costSummary,
  overdraftPayoff,
  overdraftStatus,
  peakBalanceSinceInUse,
  percentCleared,
  projectedMonthlyInterest,
  usageTransition,
  usedPercent,
  type OverdraftStatus,
  type UsageTransition,
} from '../overdraft/overdraftMath';
import { useOverdraftStore } from '../overdraft/store';
import type { OverdraftEvent, OverdraftEventType } from '../overdraft/types';
import { validateAmount } from '../transactions/validateAmount';
import { validatePaymentAmount } from '../debts/validatePaymentAmount';
import { colors, radius, spacing, typography, type StatusPalette } from '../theme/tokens';

type FormMode = 'closed' | 'draw' | 'payment' | 'interest' | 'fee' | 'settings';

const FORM_TITLES: Record<Exclude<FormMode, 'closed' | 'settings'>, string> = {
  draw: 'Log draw',
  payment: 'Log payment',
  interest: 'Log interest',
  fee: 'Log fee',
};

const EVENT_LABELS: Record<OverdraftEventType, string> = {
  draw: 'Draw',
  payment: 'Payment',
  interest: 'Interest',
  fee: 'Fee',
};

const STATUS_LABELS: Record<OverdraftStatus, string> = {
  unused: 'Not in use',
  'in-use': 'In use',
  high: 'Getting close',
  'over-limit': 'Over limit',
};

function statusColor(status: OverdraftStatus): string {
  switch (status) {
    case 'in-use':
      return colors.status.notice.text;
    case 'high':
      return colors.status.warning.text;
    case 'over-limit':
      return colors.status.critical.text;
    default:
      return colors.inkMuted;
  }
}

// The rate is optional (spec 012's 2026-09-25 amendment): blank is a valid
// "unknown" (null), distinct from a real 0%; anything else must be a number.
type RateResult = { ok: true; value: number | null } | { ok: false };

function parseRate(raw: string): RateResult {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') {
    return { ok: true, value: null };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: Number(trimmed) };
}

const HISTORY_WIDTH = 358;
const HISTORY_HEIGHT = 150;
const HISTORY_TOP = 10;
const HISTORY_BASE = 116;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function OverdraftScreen() {
  const line = useOverdraftStore((s) => s.line);
  const events = useOverdraftStore((s) => s.events);
  const setupLine = useOverdraftStore((s) => s.setupLine);
  const updateLine = useOverdraftStore((s) => s.updateLine);
  const logDraw = useOverdraftStore((s) => s.logDraw);
  const logPayment = useOverdraftStore((s) => s.logPayment);
  const logInterest = useOverdraftStore((s) => s.logInterest);
  const logFee = useOverdraftStore((s) => s.logFee);
  const deleteEvent = useOverdraftStore((s) => s.deleteEvent);

  const [mode, setMode] = useState<FormMode>('closed');
  const [amountText, setAmountText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [date, setDate] = useState(new Date());
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ transition: UsageTransition; balance: number } | null>(null);

  const [limitText, setLimitText] = useState('');
  const [rateText, setRateText] = useState('');
  const [plannedText, setPlannedText] = useState('');
  const [openingText, setOpeningText] = useState('');
  const [limitError, setLimitError] = useState<string | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);

  function readSettings(includeOpening: boolean) {
    const limit = validateAmount(limitText);
    const rate = parseRate(rateText);
    const planned = plannedText.trim() === '' ? null : validateAmount(plannedText);
    const opening = includeOpening && openingText.trim() !== '' ? validateAmount(openingText) : null;

    setLimitError(limit.ok ? null : limit.error);
    setRateError(rate.ok ? null : 'Enter a monthly rate, like 1.9.');
    setPlannedError(planned && !planned.ok ? planned.error : null);
    setOpeningError(opening && !opening.ok ? opening.error : null);

    if (!limit.ok || !rate.ok || (planned && !planned.ok) || (opening && !opening.ok)) {
      return null;
    }
    return {
      limit: limit.value,
      monthlyRate: rate.value,
      plannedMonthlyPayment: planned && planned.ok ? planned.value : null,
      openingBalance: opening && opening.ok ? opening.value : null,
    };
  }

  async function handleSaveSetup() {
    const settings = readSettings(true);
    if (!settings) {
      return;
    }
    await setupLine(settings);
  }

  function openSettings() {
    if (!line) {
      return;
    }
    setLimitText(String(line.limit));
    setRateText(line.monthlyRate === null ? '' : String(line.monthlyRate));
    setPlannedText(line.plannedMonthlyPayment ? String(line.plannedMonthlyPayment) : '');
    setLimitError(null);
    setRateError(null);
    setPlannedError(null);
    setMode('settings');
  }

  async function handleSaveSettings() {
    const settings = readSettings(false);
    if (!settings) {
      return;
    }
    await updateLine({
      limit: settings.limit,
      monthlyRate: settings.monthlyRate,
      plannedMonthlyPayment: settings.plannedMonthlyPayment,
    });
    setMode('closed');
  }

  function openForm(next: Exclude<FormMode, 'closed' | 'settings'>) {
    setAmountText('');
    setNoteText('');
    setDate(new Date());
    setFormError(null);
    setMode(next);
  }

  if (!line) {
    return (
      <Screen testID="overdraft-screen">
        <Text style={styles.title}>Overdraft</Text>
        <View style={styles.card} testID="overdraft-setup-form">
          <Text style={styles.sectionTitle}>Set up your line</Text>
          <Text style={styles.helper}>
            Enter your approved limit and the monthly rate on your statement. Don't know the rate? Leave the rate
            blank and add it later from Edit settings. If you already owe something on the line, add that as the
            opening balance.
          </Text>
          <Input label="Limit" value={limitText} onChangeText={setLimitText} keyboardType="number-pad" error={limitError} testID="setup-limit-input" />
          <Input label="Monthly rate, % (optional)" value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" error={rateError} testID="setup-rate-input" />
          <Input label="Planned monthly payment (optional)" value={plannedText} onChangeText={setPlannedText} keyboardType="number-pad" error={plannedError} testID="setup-planned-payment-input" />
          <Input label="Opening balance (optional)" value={openingText} onChangeText={setOpeningText} keyboardType="number-pad" error={openingError} testID="setup-opening-balance-input" />
          <Button title="Save" onPress={handleSaveSetup} testID="save-overdraft-line-button" />
        </View>
      </Screen>
    );
  }

  const now = new Date();
  const balance = balanceOf(events);
  const status = overdraftStatus(balance, line.limit);
  const percent = usedPercent(balance, line.limit);
  const cost = costSummary(events, now);
  const carrying = projectedMonthlyInterest(balance, line.monthlyRate);
  const peak = peakBalanceSinceInUse(events);
  const cleared = Math.floor(percentCleared(balance, peak) * 100);
  const payoff = overdraftPayoff(balance, line.monthlyRate, line.plannedMonthlyPayment);
  const history = balanceHistory(events, now);
  const sortedEvents = [...events].sort(
    (a, b) => b.date.getTime() - a.date.getTime() || b.createdAt.getTime() - a.createdAt.getTime()
  );

  async function handleConfirm() {
    if (!line || mode === 'closed' || mode === 'settings') {
      return;
    }
    const result = mode === 'payment' ? validatePaymentAmount(amountText, balance) : validateAmount(amountText);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    const input = { amount: result.value, date, note: noteText.trim() === '' ? null : noteText.trim() };
    if (mode === 'draw') {
      await logDraw(input);
    } else if (mode === 'payment') {
      await logPayment(input);
    } else if (mode === 'interest') {
      await logInterest(input);
    } else {
      await logFee(input);
    }
    // Interest and fees raise what's owed too, so they can cross a threshold.
    const after = mode === 'payment' ? balance - input.amount : balance + input.amount;
    const transition = usageTransition(balance, after, line.limit);
    setMode('closed');
    setConfirmation(transition ? { transition, balance: after } : null);
  }

  function renderConfirmation() {
    if (!line || !confirmation) {
      return null;
    }
    const shown = confirmation.balance;
    const pct = usedPercent(shown, line.limit);
    const projectedInterest = projectedMonthlyInterest(shown, line.monthlyRate);
    let palette: StatusPalette = colors.status.notice;
    let icon: 'info' | 'warning' | 'stop' = 'info';
    let title = "You're now using your overdraft";
    // With an unknown rate there's no carrying cost to quote, so that
    // sentence is dropped and the rest of the copy stands.
    let body = `Balance ${formatCLP(shown)}, ${pct}% of your ${formatCLP(line.limit)} line.${
      projectedInterest === null
        ? ''
        : ` At ${line.monthlyRate}% a month, carrying this costs about ${formatCLP(projectedInterest)} a month.`
    }`;
    if (confirmation.transition === 'crossed-high') {
      palette = colors.status.warning;
      icon = 'warning';
      title = 'You crossed 75% of your line';
      body = `Balance ${formatCLP(shown)}, ${pct}%, with ${formatCLP(availableOf(shown, line.limit))} left.${
        projectedInterest === null ? '' : ` Carrying cost is now about ${formatCLP(projectedInterest)} a month.`
      }`;
    } else if (confirmation.transition === 'crossed-limit') {
      palette = colors.status.critical;
      icon = 'stop';
      title = "You're now over your limit";
      body = `Balance ${formatCLP(shown)}, ${pct}% of your line — ${formatCLP(shown - line.limit)} over.`;
    }
    return (
      <View
        testID="overdraft-confirmation"
        style={[styles.confirmation, { backgroundColor: palette.tone, borderColor: palette.border }]}
      >
        <View style={styles.confirmationHeader}>
          <StatusIcon kind={icon} color={palette.text} size={22} />
          <Text style={[styles.confirmationTitle, { color: palette.dark }]}>{title}</Text>
        </View>
        <Text style={[styles.confirmationBody, { color: palette.dark }]}>{body}</Text>
        <Pressable
          testID="dismiss-confirmation-button"
          onPress={() => setConfirmation(null)}
          style={[styles.confirmationButton, { backgroundColor: palette.dark }]}
        >
          <Text style={styles.confirmationButtonLabel}>Got it</Text>
        </Pressable>
      </View>
    );
  }

  function renderPayoff() {
    switch (payoff.kind) {
      case 'done':
        return <Text style={styles.payoffText}>You're back to zero — nothing owed on the line.</Text>;
      case 'no-plan':
        return (
          <Pressable testID="set-planned-payment-button" onPress={openSettings} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Set a planned payment to see when it clears</Text>
          </Pressable>
        );
      case 'not-covering':
        return (
          <Text style={styles.payoffText}>
            Your payment doesn't cover the interest — the balance won't shrink.
          </Text>
        );
      case 'at-least':
        return (
          <>
            <Text style={styles.payoffText}>
              {`Clears in at least ${payoff.months} ${payoff.months === 1 ? 'month' : 'months'}, not counting interest.`}
            </Text>
            <Pressable testID="add-rate-button" onPress={openSettings} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Add your rate for a real estimate</Text>
            </Pressable>
          </>
        );
      default:
        return (
          <Text style={styles.payoffText}>
            {`Clears in about ${payoff.months} ${payoff.months === 1 ? 'month' : 'months'}, paying ≈ ${formatCLP(payoff.remainingInterest)} more in interest.`}
          </Text>
        );
    }
  }

  const maxScale = Math.max(line.limit, ...history.map((p) => p.balance), 1);
  const yFor = (value: number) => HISTORY_BASE - (value / maxScale) * (HISTORY_BASE - HISTORY_TOP);
  const stepWidth = (HISTORY_WIDTH - 24) / history.length;
  let stepPath = '';
  history.forEach((p, i) => {
    const x = 12 + i * stepWidth;
    stepPath += i === 0 ? `M${x} ${yFor(p.balance)}` : ` V${yFor(p.balance)}`;
    stepPath += ` H${x + stepWidth}`;
  });
  const lastY = yFor(history[history.length - 1].balance);
  const areaPath = `${stepPath} V${HISTORY_BASE} H12 Z`;

  const isLogForm = mode !== 'closed' && mode !== 'settings';

  return (
    <Screen testID="overdraft-screen">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Overdraft</Text>
      </View>

      {renderConfirmation()}

      <View style={styles.card} testID="overdraft-gauge">
        <View style={styles.rowBetween}>
          <Text style={styles.eyebrow}>USED</Text>
          <View testID="overdraft-status" style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(status) }]} />
            <Text style={styles.statusLabel}>{STATUS_LABELS[status]}</Text>
          </View>
        </View>
        <Text style={styles.bigNumber}>{formatCLP(balance)}</Text>
        <Text style={styles.helper}>{`of ${formatCLP(line.limit)} limit`}</Text>
        <View style={styles.gaugeTrack}>
          <View
            testID="overdraft-gauge-fill"
            style={[styles.gaugeFill, { width: `${Math.min(100, percent)}%`, backgroundColor: statusColor(status) }]}
          />
          <View testID="overdraft-gauge-threshold" style={styles.gaugeThreshold} />
        </View>
        <View style={styles.thresholdLabelRow}>
          <Text style={styles.thresholdLabel}>75%</Text>
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.strong}>{`${percent}% used`}</Text>
          <Text style={styles.helper}>{`${formatCLP(availableOf(balance, line.limit))} available`}</Text>
        </View>
        <View style={styles.buttonRow}>
          <View style={styles.flex}>
            <Button title="Log draw" onPress={() => openForm('draw')} testID="log-draw-button" />
          </View>
          <Pressable testID="log-payment-button" onPress={() => openForm('payment')} style={[styles.outlineButton, styles.flex]}>
            <Text style={styles.outlineButtonLabel}>Log payment</Text>
          </Pressable>
        </View>
      </View>

      {isLogForm && (
        <View style={styles.card} testID="overdraft-form">
          <Text style={styles.sectionTitle}>{FORM_TITLES[mode]}</Text>
          <Input label="Amount" value={amountText} onChangeText={setAmountText} keyboardType="number-pad" error={formError} testID="overdraft-amount-input" />
          <DatePickerField label="Date" value={date} onChange={setDate} testID="overdraft-date-input" />
          <Input label="Note (optional)" value={noteText} onChangeText={setNoteText} testID="overdraft-note-input" />
          <Button title="Save" onPress={handleConfirm} testID="confirm-overdraft-button" />
          <Pressable testID="cancel-overdraft-button" onPress={() => setMode('closed')} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {mode === 'settings' && (
        <View style={styles.card} testID="overdraft-settings-form">
          <Text style={styles.sectionTitle}>Line settings</Text>
          <Input label="Limit" value={limitText} onChangeText={setLimitText} keyboardType="number-pad" error={limitError} testID="settings-limit-input" />
          <Input label="Monthly rate, % (optional)" value={rateText} onChangeText={setRateText} keyboardType="decimal-pad" error={rateError} testID="settings-rate-input" />
          <Input label="Planned monthly payment (optional)" value={plannedText} onChangeText={setPlannedText} keyboardType="number-pad" error={plannedError} testID="settings-planned-payment-input" />
          <Button title="Save" onPress={handleSaveSettings} testID="save-overdraft-settings-button" />
          <Pressable onPress={() => setMode('closed')} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.termsCard} testID="overdraft-terms">
        <View style={styles.termsHeader}>
          <Text style={styles.termsTitle}>Line terms</Text>
          <Pressable testID="edit-overdraft-settings-button" onPress={openSettings} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Edit</Text>
          </Pressable>
        </View>
        <View style={styles.termsRow} testID="terms-limit">
          <Text style={styles.helperBase}>Limit</Text>
          <Text style={styles.strong}>{formatCLP(line.limit)}</Text>
        </View>
        <View style={styles.termsRow} testID="terms-rate">
          <Text style={styles.helperBase}>Monthly rate</Text>
          {line.monthlyRate === null ? (
            <Pressable testID="terms-add-rate-button" onPress={openSettings} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Not set · Add</Text>
            </Pressable>
          ) : (
            <Text style={styles.strong}>{`${line.monthlyRate}%`}</Text>
          )}
        </View>
        <View style={styles.termsRow} testID="terms-planned">
          <Text style={styles.helperBase}>Planned payment</Text>
          {line.plannedMonthlyPayment ? (
            <Text style={styles.strong}>{`${formatCLP(line.plannedMonthlyPayment)} / month`}</Text>
          ) : (
            <Pressable testID="terms-add-payment-button" onPress={openSettings} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Not set · Add</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>What it's costing you</Text>
      <View style={styles.card} testID="overdraft-cost-month">
        <Text style={styles.eyebrow}>CHARGED THIS MONTH</Text>
        <Text style={styles.midNumber}>{formatCLP(cost.interestThisMonth + cost.feesThisMonth)}</Text>
        <View style={styles.splitRow}>
          <Text style={styles.helper}>{`Interest ${formatCLP(cost.interestThisMonth)}`}</Text>
          <Text style={styles.helper}>{`Fees ${formatCLP(cost.feesThisMonth)}`}</Text>
        </View>
      </View>
      <View style={styles.costRow}>
        <View style={[styles.card, styles.flex]} testID="overdraft-cost-carrying">
          <Text style={styles.eyebrow}>CARRYING COST</Text>
          {carrying === null ? (
            <Pressable testID="carrying-add-rate-button" onPress={openSettings} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Add your rate to see this</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.smallNumber}>{`${formatCLP(carrying)} / mo`}</Text>
              <Text style={styles.helper}>at the current balance</Text>
            </>
          )}
        </View>
        <View style={[styles.card, styles.flex]} testID="overdraft-cost-total">
          <Text style={styles.eyebrow}>TOTAL PAID</Text>
          <Text style={styles.smallNumber}>{formatCLP(cost.totalCost)}</Text>
          <Text style={styles.helper}>interest + fees, all time</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Road to zero</Text>
      <View style={styles.card} testID="overdraft-road">
        <View style={styles.rowBetween}>
          <Text style={styles.eyebrow}>YOU OWE</Text>
          <Text style={styles.midNumber}>{formatCLP(balance)}</Text>
        </View>
        <View style={styles.clearedTrack}>
          <View testID="overdraft-cleared-fill" style={[styles.clearedFill, { width: `${cleared}%` }]} />
        </View>
        {balance > 0 && <Text style={styles.helper}>{`${cleared}% cleared from the ${formatCLP(peak)} peak`}</Text>}
        {line.plannedMonthlyPayment ? (
          <View style={styles.rowBetween}>
            <Text style={styles.helper}>Planned payment</Text>
            <Text style={styles.strong}>{`${formatCLP(line.plannedMonthlyPayment)} / month`}</Text>
          </View>
        ) : null}
        {renderPayoff()}
      </View>

      <Text style={styles.sectionTitle}>Balance, last 6 months</Text>
      <View style={styles.card} testID="overdraft-history">
        <Svg width="100%" height={HISTORY_HEIGHT} viewBox={`0 0 ${HISTORY_WIDTH} ${HISTORY_HEIGHT}`}>
          <Line x1={8} y1={yFor(line.limit)} x2={HISTORY_WIDTH - 8} y2={yFor(line.limit)} stroke={colors.status.critical.text} strokeWidth={1} strokeDasharray="4 4" />
          <SvgText x={12} y={yFor(line.limit) + 12} fontSize={10} fill={colors.inkSecondary}>{`Limit ${formatCLP(line.limit)}`}</SvgText>
          <Line x1={8} y1={yFor(line.limit * 0.75)} x2={HISTORY_WIDTH - 8} y2={yFor(line.limit * 0.75)} stroke={colors.inkMuted} strokeWidth={1} strokeDasharray="2 4" />
          <Line x1={8} y1={HISTORY_BASE} x2={HISTORY_WIDTH - 8} y2={HISTORY_BASE} stroke={colors.border} strokeWidth={1} />
          <Path d={areaPath} fill={colors.status.notice.text} fillOpacity={0.14} />
          <Path d={stepPath} fill="none" stroke={colors.status.notice.text} strokeWidth={2.5} strokeLinejoin="round" />
          <Circle cx={12 + history.length * stepWidth} cy={lastY} r={4.5} fill={colors.status.notice.text} />
          {history.map((p, i) => (
            <SvgText key={`${p.year}-${p.month}`} x={12 + i * stepWidth + stepWidth / 2} y={136} fontSize={11} fill={colors.inkSecondary} textAnchor="middle">
              {MONTH_LABELS[p.month - 1]}
            </SvgText>
          ))}
        </Svg>
      </View>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        <View style={styles.splitRow}>
          <Pressable testID="log-interest-button" onPress={() => openForm('interest')} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Log interest</Text>
          </Pressable>
          <Pressable testID="log-fee-button" onPress={() => openForm('fee')} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Log fee</Text>
          </Pressable>
        </View>
      </View>
      {sortedEvents.length === 0 ? (
        <Text style={styles.helper} testID="overdraft-empty">
          No activity yet. Log a draw when the bank tops up your account.
        </Text>
      ) : (
        <View style={styles.card}>
          {sortedEvents.map((e) => (
            <EventRow key={e.id} event={e} onDelete={() => deleteEvent(e.id)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function EventRow({ event, onDelete }: { event: OverdraftEvent; onDelete: () => void }) {
  const isPayment = event.type === 'payment';
  const amount = `${isPayment ? '−' : '+'}${formatCLP(event.amount)}`;
  const amountColor = isPayment ? colors.success : event.type === 'draw' ? colors.status.notice.text : colors.ink;
  return (
    <View testID={`overdraft-event-${event.id}`} style={styles.eventRow}>
      <View style={styles.flex}>
        <Text style={styles.strong}>{EVENT_LABELS[event.type]}</Text>
        <Text style={styles.helper}>{event.note ? `${formatShortDate(event.date)} · ${event.note}` : formatShortDate(event.date)}</Text>
      </View>
      <Text style={[styles.strong, { color: amountColor }]}>{amount}</Text>
      <Pressable testID={`delete-event-${event.id}`} onPress={onDelete} style={styles.linkButton}>
        <Text style={styles.linkLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: typography.display, fontSize: typography.size.xl, color: colors.ink },
  sectionTitle: {
    fontFamily: typography.display,
    fontSize: typography.size.lg,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
  },
  eyebrow: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs,
    letterSpacing: 0.7,
    color: colors.inkSecondary,
  },
  helper: { fontFamily: typography.body, fontSize: typography.size.sm, color: colors.inkSecondary },
  helperBase: { fontFamily: typography.body, fontSize: typography.size.base, color: colors.inkSecondary },
  termsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm + 4,
  },
  termsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  termsTitle: { fontFamily: typography.display, fontSize: typography.size.lg, color: colors.ink },
  termsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  strong: { fontFamily: typography.bodyBold, fontSize: typography.size.base, color: colors.ink },
  bigNumber: { fontFamily: typography.display, fontSize: 40, color: colors.ink },
  midNumber: { fontFamily: typography.display, fontSize: typography.size.xl, color: colors.ink },
  smallNumber: { fontFamily: typography.display, fontSize: typography.size.lg, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  splitRow: { flexDirection: 'row', gap: spacing.md },
  costRow: { flexDirection: 'row', gap: spacing.sm + 4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: 999,
    backgroundColor: colors.background,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontFamily: typography.bodyBold, fontSize: typography.size.xs, color: colors.ink },
  gaugeTrack: {
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  gaugeFill: { height: 24, borderRadius: 12 },
  gaugeThreshold: { position: 'absolute', left: '75%', top: -4, width: 2, height: 32, backgroundColor: colors.ink },
  thresholdLabelRow: { height: 16 },
  thresholdLabel: {
    position: 'absolute',
    left: '75%',
    fontFamily: typography.body,
    fontSize: 11,
    color: colors.inkSecondary,
  },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  outlineButton: {
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineButtonLabel: { fontFamily: typography.bodyBold, fontSize: typography.size.base, color: colors.accent },
  linkButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkLabel: { fontFamily: typography.bodyBold, fontSize: typography.size.sm + 1, color: colors.accent },
  clearedTrack: { height: 12, borderRadius: 6, backgroundColor: colors.background, marginVertical: spacing.sm },
  clearedFill: { height: 12, borderRadius: 6, backgroundColor: colors.accent },
  payoffText: { fontFamily: typography.bodyBold, fontSize: typography.size.base, color: colors.ink, marginTop: spacing.sm, lineHeight: 22 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  confirmation: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm + 4,
    gap: spacing.sm,
  },
  confirmationHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  confirmationTitle: { flex: 1, fontFamily: typography.display, fontSize: typography.size.lg },
  confirmationBody: { fontFamily: typography.body, fontSize: typography.size.base - 1, lineHeight: 21 },
  confirmationButton: {
    minHeight: 44,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationButtonLabel: { fontFamily: typography.bodyBold, fontSize: typography.size.base, color: colors.onAccent },
});
