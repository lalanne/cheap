module.exports = {
  testEnvironment: 'node',
  // One emulator, one Firestore namespace (demo-cheap), and each file calls
  // clearFirestore() in afterEach — so the files must not run in parallel.
  maxWorkers: 1,
  roots: ['<rootDir>/firebase/tests'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/firebase/tests/tsconfig.json' }],
  },
};
