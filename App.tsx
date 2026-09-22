// Import each weight's own subpath (not the package root) — the root index
// unconditionally requires all 18 weight files per family, bloating the
// bundle with fonts we never use.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from './src/auth/store';
import { startBudgetsSync } from './src/budgets/store';
import { startDebtsSync } from './src/debts/store';
import { BudgetsScreen } from './src/screens/BudgetsScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { DebtsScreen } from './src/screens/DebtsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { startTransactionsSync } from './src/transactions/store';
import { colors, spacing, typography } from './src/theme/tokens';

type Tab = 'transactions' | 'budgets' | 'debts' | 'dashboard';

const TABS: { key: Tab; label: string }[] = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'debts', label: 'Debts' },
  { key: 'dashboard', label: 'Dashboard' },
];

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    PublicSans_400Regular,
    PublicSans_600SemiBold,
  });
  const status = useAuthStore((s) => s.status);
  const emailVerified = useAuthStore((s) => s.user?.emailVerified);
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  // Deferred to after first mount, deliberately — see transactionsStore.ts.
  useEffect(() => startTransactionsSync(), []);
  useEffect(() => startBudgetsSync(), []);
  useEffect(() => startDebtsSync(), []);

  let content;
  if (!fontsLoaded || status === 'initializing') {
    content = <View testID="loading-screen" style={styles.root} />;
  } else if (status === 'signedOut') {
    content = (
      <>
        <StatusBar style="dark" />
        <SignInScreen />
      </>
    );
  } else if (!emailVerified) {
    content = (
      <>
        <StatusBar style="dark" />
        <VerifyEmailScreen />
      </>
    );
  } else {
    let activeScreen;
    if (activeTab === 'budgets') {
      activeScreen = <BudgetsScreen />;
    } else if (activeTab === 'debts') {
      activeScreen = <DebtsScreen />;
    } else if (activeTab === 'dashboard') {
      activeScreen = <DashboardScreen />;
    } else {
      activeScreen = <TransactionsScreen />;
    }

    content = (
      <View testID="main-app" style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.tabBar} testID="tab-bar">
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={activeTab === tab.key ? styles.tabActive : styles.tab}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={activeTab === tab.key ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
        {activeScreen}
      </View>
    );
  }

  return <SafeAreaProvider>{content}</SafeAreaProvider>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
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
});
