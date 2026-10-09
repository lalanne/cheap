import type { CSSProperties } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatLocalDate } from './formatLocalDate';
import { colors, radius, spacing, typography } from '../theme/tokens';

type DatePickerFieldProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  testID?: string;
};

export function DatePickerField({ label, value, onChange, testID }: DatePickerFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      {/* Browser-native <input type="date"> — this file only ever ships to
          the web bundle, so a raw DOM element is fine here. */}
      <input
        data-testid={testID}
        type="date"
        value={formatLocalDate(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw) {
            onChange(new Date(`${raw}T00:00:00`));
          }
        }}
        style={webInputStyle}
      />
    </View>
  );
}

const webInputStyle: CSSProperties = {
  height: 46,
  borderRadius: radius.input,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.surface,
  paddingLeft: spacing.sm + 6,
  paddingRight: spacing.sm + 6,
  fontFamily: typography.body,
  fontSize: typography.size.base,
  color: colors.ink,
  width: '100%',
  boxSizing: 'border-box',
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
    marginBottom: spacing.xs + 2,
  },
});
