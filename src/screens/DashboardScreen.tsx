import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Screen } from '../components/Screen';
import { useBudgetsStore } from '../budgets/store';
import { computeCategorySpend } from '../budgets/computeCategorySpend';
import { useDebtsStore } from '../debts/store';
import { percentPaid } from '../debts/payoffMath';
import { categoryTotalsForMonth, last6MonthsExpense, monthlyTotals } from '../dashboard/aggregation';
import { computeDonutSegments } from '../dashboard/donutSegments';
import { computeSuggestions, type Suggestion } from '../dashboard/suggestions';
import { useTransactionsStore } from '../transactions/store';
import { useWideWeb } from '../theme/useWideWeb';
import { colors, radius, spacing, typography } from '../theme/tokens';

const DONUT_RADIUS = 60;
const DONUT_STROKE = 16;
const DONUT_SIZE = (DONUT_RADIUS + DONUT_STROKE) * 2;

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

export function DashboardScreen() {
  const isWideWeb = useWideWeb();
  const transactions = useTransactionsStore((s) => s.transactions);
  const budgets = useBudgetsStore((s) => s.budgets);
  const debts = useDebtsStore((s) => s.debts);

  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const categorySpend = categoryTotalsForMonth(transactions, now);
  const thisMonth = monthlyTotals(transactions, now);
  const lastMonth = monthlyTotals(transactions, lastMonthDate);
  const trend = last6MonthsExpense(transactions, now);
  const suggestions = computeSuggestions({ budgets, categorySpend, debts, thisMonth, lastMonth });
  const donutSegments = computeDonutSegments(categorySpend, DONUT_RADIUS);
  const totalDebtRemaining = debts.reduce((sum, d) => sum + d.currentBalance, 0);
  const maxTrend = Math.max(1, ...trend.map((m) => m.total));
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
      <Text style={styles.cardTitle}>Budgets this month</Text>
      {budgets.length === 0 ? (
        <Text style={styles.emptyText} testID="dashboard-budgets-empty">
          No budgets set yet.
        </Text>
      ) : (
        <View style={styles.barList}>
          {budgets.map((b) => {
            const spend = categorySpend[b.category] ?? 0;
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
        <Text style={styles.kpiLabel}>Spent this month</Text>
        <Text style={styles.kpiValue}>{formatCLP(thisMonth.expense)}</Text>
      </View>
      <View style={styles.kpiTile} testID="dashboard-kpi-saved">
        <Text style={styles.kpiLabel}>Saved this month</Text>
        <Text style={[styles.kpiValue, { color: colors.success }]}>
          {formatCLP(thisMonth.income - thisMonth.expense)}
        </Text>
      </View>
      <View style={styles.kpiTile} testID="dashboard-kpi-debt">
        <Text style={styles.kpiLabel}>Total debt remaining</Text>
        <Text style={styles.kpiValue}>{formatCLP(totalDebtRemaining)}</Text>
      </View>
    </View>
  );

  const donutCard = (
    <View style={styles.card} testID="dashboard-donut">
      <Text style={styles.cardTitle}>Where it went</Text>
      {donutSegments.length === 0 ? (
        <Text style={styles.emptyText}>No spend recorded this month.</Text>
      ) : (
        <>
          <View style={styles.donutWrap}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE} testID="dashboard-donut-svg">
              {donutSegments.map((seg) => (
                <Circle
                  key={seg.category}
                  cx={DONUT_SIZE / 2}
                  cy={DONUT_SIZE / 2}
                  r={DONUT_RADIUS}
                  stroke={seg.color}
                  strokeWidth={DONUT_STROKE}
                  strokeDasharray={`${2 * Math.PI * DONUT_RADIUS}`}
                  strokeDashoffset={seg.dashOffset}
                  fill="transparent"
                  rotation="-90"
                  origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
                />
              ))}
            </Svg>
          </View>
          <View style={styles.legend}>
            {donutSegments.map((seg) => (
              <View key={seg.category} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <Text style={styles.legendLabel}>
                  {seg.category} · {formatCLP(categorySpend[seg.category] ?? 0)}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const trendCard = (
    <View style={styles.card} testID="dashboard-trend">
      <Text style={styles.cardTitle}>Spend, last 6 months</Text>
      <View style={styles.trendRow}>
        {trend.map((m, i) => (
          <View key={`${m.year}-${m.month}`} style={styles.trendCol} testID={`dashboard-trend-bar-${i}`}>
            <View style={[styles.trendBar, { height: Math.max(4, (m.total / maxTrend) * 100) }]} />
            <Text style={styles.trendLabel}>{monthLabels[m.month - 1]}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const debtsCard = (
    <View style={styles.card} testID="dashboard-debts">
      <Text style={styles.cardTitle}>Debt payoff</Text>
      {debts.length === 0 ? (
        <Text style={styles.emptyText} testID="dashboard-debts-empty">
          No debts tracked yet.
        </Text>
      ) : (
        <View style={styles.barList}>
          {debts.map((d) => {
            const percent = percentPaid(d.originalAmount, d.currentBalance);
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
  },
  legend: {
    gap: spacing.xs + 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
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
});
