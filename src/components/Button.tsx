import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  testID?: string;
};

export function Button({ title, onPress, testID }: ButtonProps) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.container}>
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
  label: {
    color: colors.onAccent,
    fontFamily: typography.bodyBold,
    fontSize: typography.size.base,
  },
});
