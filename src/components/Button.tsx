import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  testID?: string;
  disabled?: boolean;
};

export function Button({ title, onPress, testID, disabled = false }: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
      style={[styles.container, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.onAccent,
    fontFamily: typography.bodyBold,
    fontSize: typography.size.base,
  },
});
