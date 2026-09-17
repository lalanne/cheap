import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../theme/tokens';

type CardProps = {
  children: ReactNode;
  testID?: string;
};

export function Card({ children, testID }: CardProps) {
  return (
    <View testID={testID} style={styles.container}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
});
