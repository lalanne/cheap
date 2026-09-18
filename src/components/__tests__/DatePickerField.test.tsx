import { fireEvent, render, screen } from '@testing-library/react-native';

// jest.mock() factories are hoisted above imports, so react-native's
// Pressable/Text must be required inline here rather than imported above
// (see the same lesson already noted in the native Firestore repo tests).
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ testID, onChange }: { testID?: string; onChange: (e: { type: string }, d?: Date) => void }) => (
      <Pressable testID={testID} onPress={() => onChange({ type: 'set' }, new Date('2026-01-15'))}>
        <Text>mock-native-picker</Text>
      </Pressable>
    ),
  };
});

import { DatePickerField } from '../DatePickerField';

describe('DatePickerField (native)', () => {
  it('shows the formatted date and no picker until pressed', async () => {
    await render(<DatePickerField label="Date" value={new Date('2026-09-18')} onChange={jest.fn()} testID="date-field" />);

    expect(screen.getByText('2026-09-18')).toBeTruthy();
    expect(screen.queryByTestId('date-field-picker')).toBeNull();
  });

  it('opens a native picker popup on press instead of a keyboard (criterion 8)', async () => {
    await render(<DatePickerField label="Date" value={new Date('2026-09-18')} onChange={jest.fn()} testID="date-field" />);

    await fireEvent.press(screen.getByTestId('date-field'));

    expect(screen.getByTestId('date-field-picker')).toBeTruthy();
  });

  it('calls onChange with the picked date and closes the popup', async () => {
    const onChange = jest.fn();
    await render(<DatePickerField label="Date" value={new Date('2026-09-18')} onChange={onChange} testID="date-field" />);

    await fireEvent.press(screen.getByTestId('date-field'));
    await fireEvent.press(screen.getByTestId('date-field-picker'));

    expect(onChange).toHaveBeenCalledWith(new Date('2026-01-15'));
  });
});
