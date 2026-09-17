import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';

import App from '../../App';

jest.mock('expo-font', () => ({
  useFonts: jest.fn(),
}));

describe('App', () => {
  it('shows a loading state while fonts are loading (spec 003, criterion 2)', async () => {
    (useFonts as jest.Mock).mockReturnValue([false, null]);

    await render(<App />);

    expect(screen.getByTestId('loading-screen')).toBeTruthy();
    expect(screen.queryByTestId('main-app')).toBeNull();
  });

  it('renders the main app once fonts have loaded', async () => {
    (useFonts as jest.Mock).mockReturnValue([true, null]);

    await render(<App />);

    expect(screen.getByTestId('main-app')).toBeTruthy();
    expect(screen.queryByTestId('loading-screen')).toBeNull();
  });
});
