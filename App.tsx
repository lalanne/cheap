// Import each weight's own subpath (not the package root) — the root index
// unconditionally requires all 18 weight files per family, bloating the
// bundle with fonts we never use.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from './src/auth/store';
import { SignInScreen } from './src/screens/SignInScreen';
import { TransactionsScreen } from './src/screens/TransactionsScreen';
import { VerifyEmailScreen } from './src/screens/VerifyEmailScreen';
import { startTransactionsSync } from './src/transactions/store';
import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    PublicSans_400Regular,
    PublicSans_600SemiBold,
  });
  const status = useAuthStore((s) => s.status);
  const emailVerified = useAuthStore((s) => s.user?.emailVerified);

  // Deferred to after first mount, deliberately — see transactionsStore.ts.
  useEffect(() => startTransactionsSync(), []);

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
    content = (
      <View testID="main-app" style={styles.root}>
        <StatusBar style="dark" />
        <TransactionsScreen />
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
});
