import { Platform } from 'react-native';
import { renderHook } from '@testing-library/react-native';

import { useWideWeb } from '../useWideWeb';

const mockUseWindowDimensions = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

describe('useWideWeb', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('is false on native regardless of width', async () => {
    Platform.OS = 'ios';
    mockUseWindowDimensions.mockReturnValue({ width: 1400, height: 900 });

    const { result } = await renderHook(() => useWideWeb());

    expect(result.current).toBe(false);
  });

  it('is false on web below the breakpoint', async () => {
    Platform.OS = 'web';
    mockUseWindowDimensions.mockReturnValue({ width: 899, height: 900 });

    const { result } = await renderHook(() => useWideWeb());

    expect(result.current).toBe(false);
  });

  it('is true on web at or above the 900px breakpoint', async () => {
    Platform.OS = 'web';
    mockUseWindowDimensions.mockReturnValue({ width: 900, height: 900 });

    const { result } = await renderHook(() => useWideWeb());

    expect(result.current).toBe(true);
  });
});
