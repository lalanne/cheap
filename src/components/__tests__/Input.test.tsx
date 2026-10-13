import { fireEvent, render, screen } from '@testing-library/react-native';

import { Input } from '../Input';

describe('Input', () => {
  it('renders its label and reports text changes', async () => {
    const onChangeText = jest.fn();
    await render(<Input label="Email" value="" onChangeText={onChangeText} testID="input" />);

    await fireEvent.changeText(screen.getByTestId('input'), 'jane@example.com');

    expect(screen.getByText('Email')).toBeTruthy();
    expect(onChangeText).toHaveBeenCalledWith('jane@example.com');
  });

  it('shows a validation error when given one', async () => {
    await render(
      <Input label="Password" value="" onChangeText={jest.fn()} error="At least 8 characters." />,
    );

    expect(screen.getByText('At least 8 characters.')).toBeTruthy();
  });

  it('renders no error text when none is given', async () => {
    await render(<Input label="Email" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByText('At least 8 characters.')).toBeNull();
  });

  it('renders identically across call sites (spec 003, criterion 3)', async () => {
    await render(
      <>
        <Input label="Email" value="" onChangeText={jest.fn()} testID="input-a" />
        <Input label="Name" value="Jane" onChangeText={jest.fn()} testID="input-b" />
      </>,
    );

    expect(screen.getByTestId('input-a').props.style).toEqual(
      screen.getByTestId('input-b').props.style,
    );
  });
});
