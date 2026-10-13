import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '../Card';

describe('Card', () => {
  it('renders its children', async () => {
    await render(
      <Card testID="card">
        <Text>Balance this month</Text>
      </Card>,
    );

    expect(screen.getByText('Balance this month')).toBeTruthy();
  });

  it('renders identically across call sites (spec 003, criterion 3)', async () => {
    await render(
      <>
        <Card testID="card-a">
          <Text>A</Text>
        </Card>
        <Card testID="card-b">
          <Text>Something longer</Text>
        </Card>
      </>,
    );

    const a = screen.getByTestId('card-a');
    const b = screen.getByTestId('card-b');

    expect(a.props.style).toEqual(b.props.style);
  });
});
