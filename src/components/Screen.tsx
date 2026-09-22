import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/tokens';

type ScreenProps = {
  children: ReactNode;
  testID?: string;
};

// Every top-level screen renders through here, not a raw View — spec 003's
// amendment after real-device testing found two gaps a simulator never
// caught (the sim build never actually launched, spec 004): content
// colliding with the status bar/notch/TestFlight banner, and a keyboard
// with no way to dismiss it or reach fields/buttons underneath.
export function Screen({ children, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      testID={testID}
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        testID="screen-scroll-view"
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          Platform.OS === 'web' && styles.webContent,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  // Spec 006: without this, content stretches edge-to-edge across a wide
  // browser window — the same mobile layout, just scaled up, not designed
  // for the space. Independent of the wide-web breakpoint (useWideWeb) —
  // applies at every width on web, including a phone's browser.
  webContent: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
});
