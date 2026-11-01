import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('renders its title and responds to press', async () => {
    const onPress = jest.fn();
    await render(<Button title="Sign in" onPress={onPress} testID="button" />);

    await fireEvent.press(screen.getByTestId('button'));

    expect(screen.getByText('Sign in')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders identically across call sites (spec 003, criterion 3)', async () => {
    await render(
      <>
        <Button title="Save" testID="button-a" />
        <Button title="Create account" testID="button-b" />
      </>,
    );

    const a = screen.getByTestId('button-a');
    const b = screen.getByTestId('button-b');

    expect(a.props.style).toEqual(b.props.style);
  });

  it('ignores presses and reports disabled when disabled (#70)', async () => {
    const onPress = jest.fn();
    await render(<Button title="Confirm" onPress={onPress} disabled testID="button" />);

    await fireEvent.press(screen.getByTestId('button'));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('button')).toBeDisabled();
  });
});
