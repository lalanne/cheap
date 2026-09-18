import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Button } from './Button';
import { colors, radius, spacing, typography } from '../theme/tokens';

type DatePickerFieldProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  testID?: string;
};

function formatDisplay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function DatePickerField({ label, value, onChange, testID }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable testID={testID} style={styles.field} onPress={() => setOpen(true)}>
        <Text style={styles.value}>{formatDisplay(value)}</Text>
      </Pressable>
      {open && (
        <View style={styles.pickerWrap}>
          <DateTimePicker
            testID={testID ? `${testID}-picker` : undefined}
            value={value}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') {
                setOpen(false);
              }
              if (event.type === 'set' && selectedDate) {
                onChange(selectedDate);
              }
            }}
          />
          {Platform.OS === 'ios' && (
            <Button
              title="Done"
              onPress={() => setOpen(false)}
              testID={testID ? `${testID}-done` : undefined}
            />
          )}
        </View>
      )}
    </View>
  );
}

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
  field: {
    height: 46,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm + 6,
    justifyContent: 'center',
  },
  value: {
    fontFamily: typography.body,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  pickerWrap: {
    marginTop: spacing.sm,
  },
});
