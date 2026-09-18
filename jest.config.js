module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/firebase/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
