import { StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../auth/store';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../theme/tokens';

export function VerifyEmailScreen() {
  const email = useAuthStore((s) => s.user?.email);
  const resendVerificationEmail = useAuthStore((s) => s.resendVerificationEmail);
  const refreshEmailVerified = useAuthStore((s) => s.refreshEmailVerified);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <Screen testID="verify-email-screen">
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.body}>
        We sent a verification link to{'\n'}
        <Text style={styles.email}>{email}</Text>
      </Text>

      <Button title="I've verified" onPress={refreshEmailVerified} testID="ive-verified-button" />
      <View style={styles.spacer} />
      <Button title="Resend email" onPress={resendVerificationEmail} testID="resend-button" />
      <View style={styles.spacer} />
      <Button title="Sign out" onPress={signOut} testID="sign-out-button" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: typography.display,
    fontSize: typography.size.xl,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: typography.body,
    fontSize: typography.size.base,
    color: colors.inkSecondary,
    marginBottom: spacing.lg,
  },
  email: {
    fontFamily: typography.bodyBold,
    color: colors.ink,
  },
  spacer: {
    height: spacing.sm,
  },
});
