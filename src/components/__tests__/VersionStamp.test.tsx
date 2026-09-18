import { render, screen } from '@testing-library/react-native';

import { VersionStamp } from '../VersionStamp';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { version: '0.1.0' },
    nativeBuildVersion: '3',
  },
}));

describe('VersionStamp', () => {
  it('shows the app version and native build number (spec 004, criterion 1)', async () => {
    await render(<VersionStamp />);

    expect(screen.getByText('v0.1.0 (3)')).toBeTruthy();
  });
});
