import { useState, type ComponentProps, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Screen } from '../components/Screen';
import { useBudgetsStore } from '../budgets/store';
import { computeCategorySpend } from '../budgets/computeCategorySpend';
import { cardBalanceAsOf, creditCardBalance } from '../creditCards/creditCardMath';
import { useCreditCardsStore } from '../creditCards/store';
import { useDebtsStore } from '../debts/store';
import { formatCLP as formatOverdraftCLP } from '../overdraft/format';
import { balanceAsOf, balanceOf, overdraftPayoff } from '../overdraft/overdraftMath';
import { useOverdraftStore } from '../overdraft/store';
import { debtBalanceAsOf, percentPaid } from '../debts/payoffMath';
import { categoryTotalsForMonth, last6MonthsExpense, monthlyTotals, type MonthExpense } from '../dashboard/aggregation';
import { rollUpCategoryTotals, subcategoryTotalsFor } from '../dashboard/categoryRollup';
import { computeDonutSegments } from '../dashboard/donutSegments';
import { computeSuggestions, type Suggestion } from '../dashboard/suggestions';
import { useTransactionsStore } from '../transactions/store';
import { useWideWeb } from '../theme/useWideWeb';
import { colors, radius, spacing, typography } from '../theme/tokens';

const DONUT_RADIUS = 60;
const DONUT_STROKE = 16;
const DONUT_SIZE = (DONUT_RADIUS + DONUT_STROKE) * 2;

// react-native-svg's web renderer forwards unrecognized props straight to
// the underlying DOM node (its prepare() spreads unknown props through
// untouched), so onMouseEnter/onMouseLeave work at runtime even though
// Circle's TypeScript types don't declare them — this cast covers that
// one gap instead of `as any`-ing every prop.
const HoverableCircle = Circle as unknown as ComponentType<
  ComponentProps<typeof Circle> & {
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }
>;

function formatCLP(amount: number): string {
  return `$${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function suggestionCopy(s: Suggestion): { title: string; detail: string; highlight: string; color: string } {
  if (s.kind === 'budget-overrun') {
    return {
      title: `${s.category} is ${Math.round((s.percent - 1) * 100)}% over budget this month`,
      detail: `${formatCLP(s.spend)} spent against a ${formatCLP(s.limit)} cap.`,
      highlight: `${Math.round(s.percent * 100)}%`,
      color: colors.chart[1],
    };
  }
  if (s.kind === 'debt-pace') {
    return {
      title: `${s.debtName} clears in ~${s.monthsAtCurrentPace} months at the current pace`,
      detail: `Doubling the minimum payment cuts that to ${s.monthsAtDoublePace} months.`,
      highlight: `${s.monthsAtCurrentPace} mo`,
      color: colors.chart[0],
    };
  }
  const deltaPoints = Math.round((s.thisMonthRate - s.lastMonthRate) * 100);
  const trendWord = deltaPoints >= 0 ? 'up' : 'down';
  return {
    title: `You saved ${Math.round(s.thisMonthRate * 100)}% of income this month — ${trendWord} from last month`,
    detail: `Last month's savings rate was ${Math.round(s.lastMonthRate * 100)}%.`,
    highlight: `${Math.round(s.thisMonthRate * 100)}%`,
    color: colors.success,
  };
}

function overdraftRowValue(balance: number, monthlyRate: number | null, planned: number | null): string {
  const payoff = overdraftPayoff(balance, monthlyRate, planned);
  const owed = formatOverdraftCLP(balance);
  return payoff.kind === 'clears' ? `${owed} · ~${payoff.months} mo` : owed;
}

export function DashboardScreen() {
  const isWideWeb = useWideWeb();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [drilledCategory, setDrilledCategory] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null);
  const transactions = useTransactionsStore((s) => s.transactions);
  const categories = useTransactionsStore((s) => s.categories);
  const budgets = useBudgetsStore((s) => s.budgets);
  const debts = useDebtsStore((s) => s.debts);
  const overdraftLine = useOverdraftStore((s) => s.line);
  const overdraftEvents = useOverdraftStore((s) => s.events);
  const creditCards = useCreditCardsStore((s) => s.cards);
  const creditCardPayments = useCreditCardsStore((s) => s.payments);

  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // categorySpend is raw/unrolled (per-leaf-category totals) — kept
  // around only for the donut's drill-down, which needs each
  // subcategory's own unrolled amount. Budgets and suggestions use
  // rolledUpTotals instead (2026-09-25 amendment, spec 011): a budget on
  // "Food" must reflect Food + its subcategories, the same number the
  // donut shows for Food — using raw spend here produced two different,
  // contradictory numbers for the same category on the same screen.
  const categorySpend = categoryTotalsForMonth(transactions, now);
  const rolledUpTotals = rollUpCategoryTotals(categorySpend, categories);
  const thisMonth = monthlyTotals(transactions, now);
  const lastMonth = monthlyTotals(transactions, lastMonthDate);
  const trend = last6MonthsExpense(transactions, now);
  const suggestions = computeSuggestions({
    budgets,
    categorySpend: rolledUpTotals,
    debts,
    thisMonth,
    lastMonth,
  });

  // Spec 009's 2026-09-25 amendment: the donut can point at a different
  // month than "now" (tapping a trend bar), independent of
  // budgets/suggestions/the KPI stack, which always reflect the current
  // month. Reuses the current month's already-computed totals when no
  // other month is selected, rather than recomputing identical numbers.
  const isCurrentMonthSelected = selectedMonth === null;
  const donutReferenceDate =
    selectedMonth === null ? now : new Date(selectedMonth.year, selectedMonth.month - 1, 1);
  const donutCategorySpend = isCurrentMonthSelected
    ? categorySpend
    : categoryTotalsForMonth(transactions, donutReferenceDate);
  const donutRolledUpTotals = isCurrentMonthSelected
    ? rolledUpTotals
    : rollUpCategoryTotals(donutCategorySpend, categories);
  const donutTotals = drilledCategory
    ? subcategoryTotalsFor(donutCategorySpend, categories, drilledCategory)
    : donutRolledUpTotals;
  const donutSegments = computeDonutSegments(donutTotals, DONUT_RADIUS);
  // Spec 012 criterion 12 — a line with a balance counts as debt and gets a
  // compact row; an unused or absent line changes nothing here.
  // Spec 009's 2026-10-10 amendment (#17): one selection scopes every figure
  // but the suggestions feed. A past month shows balances as of its end.
  const viewMonth = selectedMonth ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
  const viewTotals = isCurrentMonthSelected ? thisMonth : monthlyTotals(transactions, donutReferenceDate);
  const asOf = selectedMonth;
  const overdraftBalance = overdraftLine
    ? (asOf ? balanceAsOf(overdraftEvents, asOf) ?? 0 : balanceOf(overdraftEvents))
    : 0;
  const showOverdraft = overdraftLine !== null && overdraftBalance > 0;
  const debtRows = debts.flatMap((d) => {
    const balance = asOf ? debtBalanceAsOf(d, transactions, asOf) : d.currentBalance;
    return balance === null ? [] : [{ debt: d, balance }];
  });
  const cardRows = creditCards.flatMap((c) => {
    const balance = asOf
      ? cardBalanceAsOf(c.id, transactions, creditCardPayments, asOf)
      : creditCardBalance(c.id, transactions, creditCardPayments);
    return balance === null ? [] : [{ card: c, balance }];
  });
  // Spec 013 criterion 8 — each card's balance (a live sum over tagged
  // transactions and payments, see creditCardMath) counts as debt too.
  const totalCreditCardBalance = cardRows.reduce((sum, r) => sum + r.balance, 0);
  const totalDebtRemaining =
    debtRows.reduce((sum, r) => sum + r.balance, 0) +
    (showOverdraft ? overdraftBalance : 0) +
    totalCreditCardBalance;
  const maxTrend = Math.max(1, ...trend.map((m) => m.total));
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const effectiveSelectedMonth = viewMonth;
  // " — Aug" when a past month is selected, '' for the current month.
  const monthSuffix = selectedMonth === null ? '' : ` — ${monthLabels[selectedMonth.month - 1]}`;

  function handleSelectMonth(m: MonthExpense) {
    setSelectedMonth({ year: m.year, month: m.month });
    setDrilledCategory(null);
  }

  const suggestionsFeed = (
    <View testID="suggestions-feed">
      {suggestions.map((s) => {
        const copy = suggestionCopy(s);
        return (
          <View key={s.id} testID={`suggestion-${s.id}`} style={[styles.suggestionCard, { borderLeftColor: copy.color }]}>
            <View style={styles.suggestionText}>
              <Text style={styles.suggestionTitle}>{copy.title}</Text>
              <Text style={styles.suggestionDetail}>{copy.detail}</Text>
            </View>
            <Text style={[styles.suggestionHighlight, { color: copy.color }]}>{copy.highlight}</Text>
          </View>
        );
      })}
    </View>
  );

  const budgetsSection = (
    <View style={styles.card} testID="dashboard-budgets">
      <Text style={styles.cardTitle}>{selectedMonth === null ? 'Budgets this month' : `Budgets${monthSuffix}`}</Text>
      {budgets.length === 0 ? (
        <Text style={styles.emptyText} testID="dashboard-budgets-empty">
          No budgets set yet.
        </Text>
      ) : (
        <View style={styles.barList}>
          {budgets.map((b) => {
            const spend = donutRolledUpTotals[b.category] ?? 0;
            const percent = b.monthlyLimit > 0 ? spend / b.monthlyLimit : 0;
            const over = percent > 1;
            return (
              <View key={b.id} testID={`dashboard-budget-${b.category}`}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{b.category}</Text>
                  <Text style={[styles.barValue, over && { color: colors.chart[1] }]}>
                    {formatCLP(spend)} / {formatCLP(b.monthlyLimit)} · {Math.round(percent * 100)}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.min(percent, 1) * 100}%`, backgroundColor: over ? colors.chart[1] : colors.accent },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  const kpiStack = (
    <View style={styles.kpiStack}>
      <View style={styles.kpiTile} testID="dashboard-kpi-spent">
        <Text style={styles.kpiLabel}>{selectedMonth === null ? 'Spent this month' : `Spent${monthSuffix}`}</Text>
        <Text style={styles.kpiValue}>{formatCLP(viewTotals.expense)}</Text>
      </View>
      <View style={styles.kpiTile} testID="dashboard-kpi-saved">
        <Text style={styles.kpiLabel}>{selectedMonth === null ? 'Saved this month' : `Saved${monthSuffix}`}</Text>
        <Text style={[styles.kpiValue, { color: colors.success }]}>
          {formatCLP(viewTotals.income - viewTotals.expense)}
        </Text>
      </View>
      <View style={styles.kpiTile} testID="dashboard-kpi-debt">
        <Text style={styles.kpiLabel}>{selectedMonth === null ? 'Total debt remaining' : `Total debt${monthSuffix}`}</Text>
        <Text style={styles.kpiValue}>{formatCLP(totalDebtRemaining)}</Text>
      </View>
    </View>
  );

  const donutTitle = [
    drilledCategory ? `${drilledCategory} — where it went` : 'Where it went',
    selectedMonth === null ? null : `— ${monthLabels[selectedMonth.month - 1]}`,
  ]
    .filter(Boolean)
    .join(' ');

  const donutCard = (
    <View style={styles.card} testID="dashboard-donut">
      <Text style={styles.cardTitle}>{donutTitle}</Text>
      {drilledCategory && (
        <Pressable testID="dashboard-donut-back" onPress={() => setDrilledCategory(null)}>
          <Text style={styles.backLink}>← All categories</Text>
        </Pressable>
      )}
      {donutSegments.length === 0 ? (
        <Text style={styles.emptyText}>No spend recorded this month.</Text>
      ) : (
        <>
          <View style={styles.donutWrap}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE} testID="dashboard-donut-svg">
              {donutSegments.map((seg) => (
                <HoverableCircle
                  key={seg.category}
                  testID={`dashboard-donut-arc-${seg.category}`}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={DONUT_RADIUS}
                  stroke={seg.color}
                  strokeWidth={DONUT_STROKE}
                  strokeDasharray={`${seg.dashLength} ${2 * Math.PI * DONUT_RADIUS}`}
                  strokeDashoffset={seg.dashOffset}
                  fill="transparent"
                  rotation="-90"
                  origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
                  {...(Platform.OS === 'web'
                    ? {
                        onMouseEnter: () => setHoveredCategory(seg.category),
                        onMouseLeave: () => setHoveredCategory(null),
                      }
                    : {})}
                />
              ))}
            </Svg>
            {hoveredCategory && (
              <View style={styles.donutCenterOverlay} pointerEvents="none" testID="dashboard-donut-hover-label">
                <Text style={styles.donutCenterCategory}>{hoveredCategory}</Text>
                <Text style={styles.donutCenterAmount}>{formatCLP(donutTotals[hoveredCategory] ?? 0)}</Text>
              </View>
            )}
          </View>
          <View style={styles.legend}>
            {donutSegments.map((seg) => {
              // A category can only be drilled into from the top-level
              // view — subcategories are capped at one level (spec 011),
              // so a row shown while already drilled is never tappable.
              const hasChildren =
                !drilledCategory && categories.some((c) => c.parentCategory === seg.category);
              const childCount = hasChildren
                ? categories.filter((c) => c.parentCategory === seg.category).length
                : 0;
              const rowContent = (
                <View style={styles.legendRowInner}>
                  <View style={styles.legendMain}>
                    <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                    <Text style={styles.legendLabel}>
                      {seg.category} · {formatCLP(donutTotals[seg.category] ?? 0)}
                    </Text>
                    {hasChildren && (
                      <Text style={styles.legendHint}>
                        {childCount} subcategor{childCount === 1 ? 'y' : 'ies'}
                      </Text>
                    )}
                  </View>
                  {hasChildren && <Text style={styles.chevron}>›</Text>}
                </View>
              );
              return hasChildren ? (
                <Pressable
                  key={seg.category}
                  testID={`dashboard-donut-legend-${seg.category}`}
                  onPress={() => setDrilledCategory(seg.category)}
                >
                  {rowContent}
                </Pressable>
              ) : (
                <View key={seg.category} testID={`dashboard-donut-legend-${seg.category}`}>
                  {rowContent}
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );

  const trendCard = (
    <View style={styles.card} testID="dashboard-trend">
      <Text style={styles.cardTitle}>Spend, last 6 months</Text>
      <View style={styles.trendRow}>
        {trend.map((m, i) => {
          const isSelected = m.year === effectiveSelectedMonth.year && m.month === effectiveSelectedMonth.month;
          return (
            <Pressable
              key={`${m.year}-${m.month}`}
              style={styles.trendCol}
              testID={`dashboard-trend-bar-${i}`}
              onPress={() => handleSelectMonth(m)}
            >
              <View style={[styles.trendBar, { height: Math.max(4, (m.total / maxTrend) * 100) }]} />
              <Text
                style={[styles.trendLabel, isSelected && styles.trendLabelSelected]}
                testID={`dashboard-trend-bar-${i}-label`}
              >
                {monthLabels[m.month - 1]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const debtsCard = (
    <View style={styles.card} testID="dashboard-debts">
      <Text style={styles.cardTitle}>{`Debt payoff${monthSuffix}`}</Text>
      {showOverdraft && overdraftLine ? (
        <View style={styles.barList} testID="dashboard-overdraft-row">
          <View style={styles.barLabelRow}>
            <Text style={styles.barLabel}>Overdraft line</Text>
            <Text style={styles.barValue}>
              {selectedMonth === null
                ? overdraftRowValue(overdraftBalance, overdraftLine.monthlyRate, overdraftLine.plannedMonthlyPayment)
                : formatOverdraftCLP(overdraftBalance)}
            </Text>
          </View>
        </View>
      ) : null}
      {cardRows.map(({ card: c, balance }) => {
        return (
          <View key={c.id} testID={`dashboard-card-${c.id}`} style={styles.barList}>
            <View style={styles.barLabelRow}>
              <Text style={styles.barLabel}>{c.name}</Text>
              <Text style={styles.barValue}>{formatCLP(balance)}</Text>
            </View>
          </View>
        );
      })}
      {debtRows.length === 0 ? (
        showOverdraft || cardRows.length > 0 ? null : (
          <Text style={styles.emptyText} testID="dashboard-debts-empty">
            {selectedMonth === null
              ? 'No debts tracked yet.'
              : `No debts recorded as of ${monthLabels[selectedMonth.month - 1]}.`}
          </Text>
        )
      ) : (
        <View style={styles.barList}>
          {debtRows.map(({ debt: d, balance }) => {
            const percent = percentPaid(d.originalAmount, balance);
            return (
              <View key={d.id} testID={`dashboard-debt-${d.id}`}>
                <View style={styles.barLabelRow}>
                  <Text style={styles.barLabel}>{d.name}</Text>
                  <Text style={styles.barValue}>{Math.round(percent * 100)}% paid</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${percent * 100}%`, backgroundColor: colors.chart[0] }]} />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <Screen testID="dashboard-screen" wide={isWideWeb}>
      <Text style={styles.title}>Dashboard</Text>

      {suggestionsFeed}

      {isWideWeb ? (
        <View style={styles.wideRow} testID="dashboard-wide-row-1">
          <View style={styles.wideHalf}>{budgetsSection}</View>
          <View style={styles.wideHalf}>{kpiStack}</View>
        </View>
      ) : (
        <>
          {budgetsSection}
          {kpiStack}
        </>
      )}

      {isWideWeb ? (
        <View style={styles.wideRow} testID="dashboard-wide-row-2">
          <View style={styles.wideThird}>{donutCard}</View>
          <View style={styles.wideThird}>{trendCard}</View>
          <View style={styles.wideThird}>{debtsCard}</View>
        </View>
      ) : (
        <>
          {donutCard}
          {trendCard}
          {debtsCard}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: typography.display,
    fontSize: typography.size.xl,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.card - 2,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.ink,
  },
  suggestionDetail: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkSecondary,
    marginTop: 2,
  },
  suggestionHighlight: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontFamily: typography.display,
    fontSize: typography.size.base,
    color: colors.ink,
    marginBottom: spacing.sm + 2,
  },
  emptyText: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkMuted,
  },
  barList: {
    gap: spacing.sm + 2,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.ink,
  },
  barValue: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkSecondary,
  },
  barTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  kpiStack: {
    gap: spacing.sm + 2,
  },
  kpiTile: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  kpiLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  kpiValue: {
    fontFamily: typography.display,
    fontSize: typography.size.lg,
    color: colors.ink,
  },
  wideRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  wideHalf: {
    flex: 1,
  },
  wideThird: {
    flex: 1,
  },
  donutWrap: {
    alignItems: 'center',
    marginBottom: spacing.sm + 2,
    position: 'relative',
  },
  donutCenterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterCategory: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs,
    color: colors.ink,
    textAlign: 'center',
  },
  donutCenterAmount: {
    fontFamily: typography.display,
    fontSize: typography.size.sm,
    color: colors.ink,
    textAlign: 'center',
  },
  legend: {
    gap: spacing.xs + 2,
  },
  legendRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs + 2,
  },
  legendMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flexShrink: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkSecondary,
  },
  legendHint: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
  chevron: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.base,
    color: colors.inkMuted,
  },
  backLink: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: 120,
  },
  trendCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  trendBar: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  trendLabel: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
  trendLabelSelected: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
  },
});
