import { useState } from 'react';
import type { KeyboardTypeOptions } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '../auth/store';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Mode = 'signin' | 'signup';

const EMAIL_KEYBOARD_TYPE: KeyboardTypeOptions = 'email-address';

export function SignInScreen() {
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const isSignin = mode === 'signin';

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  async function handleSubmit() {
    setError(null);
    if (!isSignin && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    try {
      if (isSignin) {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(name, email, password);
      }
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Something went wrong. Please try again.');
    }
  }

  async function handleForgotPassword() {
    await sendPasswordReset(email);
    setResetSent(true);
  }

  return (
    <View style={styles.container} testID="sign-in-screen">
      <Text style={styles.title}>{isSignin ? 'Welcome back' : 'Create your account'}</Text>
      <Text style={styles.subtitle}>
        {isSignin
          ? "Sign in to see where your money's going."
          : 'Start tracking your expenses and income.'}
      </Text>

      <Button title="Continue with Google" onPress={signInWithGoogle} testID="google-button" />

      <View style={styles.tabs}>
        <Pressable testID="tab-signin" style={styles.tab} onPress={() => switchMode('signin')}>
          <Text style={isSignin ? styles.tabLabelActive : styles.tabLabel}>Sign in</Text>
        </Pressable>
        <Pressable testID="tab-signup" style={styles.tab} onPress={() => switchMode('signup')}>
          <Text style={!isSignin ? styles.tabLabelActive : styles.tabLabel}>Create account</Text>
        </Pressable>
      </View>

      {!isSignin && (
        <Input label="Name" value={name} onChangeText={setName} testID="name-input" />
      )}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        testID="email-input"
        autoCapitalize="none"
        keyboardType={EMAIL_KEYBOARD_TYPE}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        testID="password-input"
        secureTextEntry
        error={error}
      />

      {isSignin && (
        <Pressable testID="forgot-password" onPress={handleForgotPassword}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      )}
      {resetSent && (
        <Text testID="reset-confirmation" style={styles.confirmation}>
          If an account exists for that email, we sent a reset link.
        </Text>
      )}

      <Button
        title={isSignin ? 'Sign in' : 'Create account'}
        onPress={handleSubmit}
        testID="submit-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontFamily: typography.display,
    fontSize: typography.size.xl,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontFamily: typography.body,
    fontSize: typography.size.base,
    color: colors.inkSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.input,
    padding: spacing.xs / 2,
    marginVertical: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.input - 2,
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
  link: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.accent,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  confirmation: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkSecondary,
    marginBottom: spacing.sm,
  },
});
