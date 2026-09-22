import { Platform, useWindowDimensions } from 'react-native';

// 900px comfortably fits a ~400px transaction list + a form panel without
// cramping — cheap has no sidebar nav to fit (unlike da2's 960px, which
// needed room for one), see spec 006.
const BREAKPOINT = 900;

export function useWideWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= BREAKPOINT;
}
