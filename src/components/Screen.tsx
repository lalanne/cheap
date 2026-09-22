import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme/tokens';

type ScreenProps = {
  children: ReactNode;
  testID?: string;
  // Spec 006: the default 560px cap is for narrow, single-column content
  // (sign-in, a form). A screen using the wide-web master-detail layout
  // (see useWideWeb) needs real room for two columns — pass wide to get a
  // much larger cap instead of the narrow one, still bounded so it doesn't
  // regress back to edge-to-edge stretching on a very wide monitor.
  wide?: boolean;
};

// Every top-level screen renders through here, not a raw View — spec 003's
// amendment after real-device testing found two gaps a simulator never
// caught (the sim build never actually launched, spec 004): content
// colliding with the status bar/notch/TestFlight banner, and a keyboard
// with no way to dismiss it or reach fields/buttons underneath.
export function Screen({ children, testID, wide }: ScreenProps) {
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
          Platform.OS === 'web' && (wide ? styles.webContentWide : styles.webContent),
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
  webContentWide: {
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
});
