// Import each weight's own subpath (not the package root) — the root index
// unconditionally requires all 18 weight files per family, bloating the
// bundle with fonts we never use.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { PublicSans_400Regular } from '@expo-google-fonts/public-sans/400Regular';
import { PublicSans_600SemiBold } from '@expo-google-fonts/public-sans/600SemiBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { colors } from './src/theme/tokens';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    PublicSans_400Regular,
    PublicSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View testID="loading-screen" style={styles.root} />;
  }

  return (
    <View testID="main-app" style={styles.root}>
      <StatusBar style="dark" />
      {/* Screens land here as specs 001 (auth) and 002 (transactions) are implemented. */}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
