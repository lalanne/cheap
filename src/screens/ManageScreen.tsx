import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { BudgetsPanel } from './BudgetsPanel';
import { CategoriesPanel } from './CategoriesPanel';
import { DebtsPanel } from './DebtsPanel';
import { useWideWeb } from '../theme/useWideWeb';
import { colors, spacing, typography } from '../theme/tokens';

// Categories/Budgets/Debts together — the things touched occasionally,
// not daily (spec 009's 2026-09-23 amendment). Composes the three
// content-only panels inside one Screen/ScrollView, same pattern
// DashboardScreen already uses for its own multi-card rows, rather than
// nesting three independently-scrolling top-level screens.
export function ManageScreen() {
  const isWideWeb = useWideWeb();

  return (
    <Screen testID="manage-screen" wide={isWideWeb}>
      <Text style={styles.title}>Manage</Text>

      {isWideWeb ? (
        <View style={styles.wideRow} testID="manage-wide-row">
          <View style={styles.wideThird}>
            <CategoriesPanel />
          </View>
          <View style={styles.wideThird}>
            <BudgetsPanel />
          </View>
          <View style={styles.wideThird}>
            <DebtsPanel />
          </View>
        </View>
      ) : (
        <>
          <CategoriesPanel />
          <View style={styles.stackGap} />
          <BudgetsPanel />
          <View style={styles.stackGap} />
          <DebtsPanel />
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
  wideRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  wideThird: {
    flex: 1,
  },
  stackGap: {
    height: spacing.xl,
  },
});
