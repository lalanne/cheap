// Import each weight's own subpath (not the package root) — the root index
// unconditionally requires all 18 weight files per family, bloating the
// bundle with fonts we never use.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from './src/auth/store';
import { startBudgetsSync } from './src/budgets/store';
import { OverdraftBanner } from './src/components/OverdraftBanner';
import { TabIcon, type TabIconName } from './src/components/TabIcon';
import { startCreditCardsSync } from './src/creditCards/store';
import { startDebtsSync } from './src/debts/store';
import { startOverdraftSync } from './src/overdraft/store';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ManageScreen } from './src/screens/ManageScreen';
import { OverdraftScreen } from './src/screens/OverdraftScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { startTransactionsSync } from './src/transactions/store';
import { colors, spacing, typography } from './src/theme/tokens';

// Spec 009's 2026-09-23 amendment: tabs grouped by how often they're
// touched, not by domain — Log (daily) / Overdraft (daily, spec 012's
// 2026-09-25 amendment) / Manage (Categories+Budgets+Debts, occasional) /
// Dashboard (deciding).
type Tab = 'transactions' | 'overdraft' | 'manage' | 'dashboard';

// Design canvas "Tab Bar Style Options", option E (chosen 2026-10-05):
// a flat, transparent bar — no track, no underline — where only the
// active tab's icon sits in a tight solid-accent capsule; everything
// else about an inactive tab (icon and label) stays plain gray.
const TABS: { key: Tab; label: string; icon: TabIconName }[] = [
  { key: 'transactions', label: 'Log', icon: 'transactions' },
  { key: 'overdraft', label: 'Overdraft', icon: 'overdraft' },
  { key: 'manage', label: 'Manage', icon: 'manage' },
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
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
  useEffect(() => startOverdraftSync(), []);
  useEffect(() => startCreditCardsSync(), []);

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
    if (activeTab === 'overdraft') {
      activeScreen = <OverdraftScreen />;
    } else if (activeTab === 'manage') {
      activeScreen = <ManageScreen />;
    } else if (activeTab === 'dashboard') {
      activeScreen = <DashboardScreen />;
    } else {
      activeScreen = <TransactionsScreen />;
    }

    content = (
      <MainApp activeTab={activeTab} setActiveTab={setActiveTab} activeScreen={activeScreen} />
    );
  }

  return <SafeAreaProvider>{content}</SafeAreaProvider>;
}

// A separate component, not inline in App() — useSafeAreaInsets() only
// resolves real values for a descendant of SafeAreaProvider, and App()
// itself builds `content` as a sibling of that provider, not inside it.
// Regression: the tab bar had no top-inset padding at all (unlike every
// screen's own content, via the Screen primitive, spec 003's 2026-09-18
// fix) because it sits here, above/outside every individual Screen — a
// real device (status bar, notch, or TestFlight's own banner) covered it.
function MainApp({
  activeTab,
  setActiveTab,
  activeScreen,
}: {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  activeScreen: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View testID="main-app" style={styles.root}>
      <StatusBar style="dark" />
      <View style={[styles.tabBar, { paddingTop: insets.top + spacing.sm }]} testID="tab-bar">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
            >
              <View
                testID={`tab-icon-${tab.key}`}
                style={isActive ? styles.tabIconBubbleActive : styles.tabIconBubble}
              >
                <TabIcon name={tab.icon} color={isActive ? colors.onAccent : colors.inkMuted} />
              </View>
              <Text style={isActive ? styles.tabLabelActive : styles.tabLabel}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <OverdraftBanner onPress={() => setActiveTab('overdraft')} />
      {activeScreen}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm + 4,
    // paddingTop comes from MainApp (safe-area inset + spacing.sm), not here.
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  tab: {
    alignItems: 'center',
    gap: spacing.xs + 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  // Only the active tab's icon sits in a capsule (option E) — an inactive
  // one gets the same padding with no fill, so the icon doesn't jump
  // position when the active tab changes.
  tabIconBubble: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.sm + 1,
  },
  tabIconBubbleActive: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
  },
  tabLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs + 1,
    color: colors.inkMuted,
  },
  tabLabelActive: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.xs + 1,
    color: colors.ink,
  },
});
