module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/firebase/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Coverage instrumentation slows the heavy render tests enough to hit
  // the 5s default when all suites run in parallel (spec 014, #24).
  testTimeout: 15000,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**'],
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
};
