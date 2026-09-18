// Every screen renders through the Screen primitive (spec 003), which
// calls useSafeAreaInsets() — needs a mocked SafeAreaProvider context in
// every component test, not just Screen's own. The library ships its own
// official mock for exactly this.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);
