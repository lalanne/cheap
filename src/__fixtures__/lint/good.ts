// Prettier-formatted and lint-clean; used by src/tooling/__tests__/eslint.test.ts.
export const config = {
  name: 'good',
  items: [1, 2, 3].map((n) => n * 2),
  describe: (verbose: boolean) => (verbose ? 'a verbose description' : 'short'),
};
// tmp
