// Spec 015, criteria 2, 5, 7–9, 11: ESLint config, scripts and hook wiring.
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

const lint = (file: string) => {
  const r = spawnSync(
    join(root, 'node_modules', '.bin', 'eslint'),
    ['--no-ignore', '--max-warnings', '0', '--format', 'json', file],
    { cwd: root, encoding: 'utf8' },
  );
  const results = JSON.parse(r.stdout || '[]');
  const ruleIds: string[] = results.flatMap((f: any) => f.messages.map((m: any) => m.ruleId));
  return { status: r.status, ruleIds };
};

describe('eslint setup (spec 015)', () => {
  it('rejects unused variables and missing hook dependencies (criterion 2)', () => {
    const { status, ruleIds } = lint('src/__fixtures__/lint/bad.tsx');
    expect(status).not.toBe(0);
    expect(ruleIds).toEqual(
      expect.arrayContaining(['@typescript-eslint/no-unused-vars', 'react-hooks/exhaustive-deps']),
    );
  });

  it('passes Prettier-formatted code with zero messages (criterion 5)', () => {
    expect(lint('src/__fixtures__/lint/good.ts')).toEqual({ status: 0, ruleIds: [] });
  });

  it('ignores the fixtures in a normal lint run', () => {
    const r = spawnSync(join(root, 'node_modules', '.bin', 'eslint'), ['--format', 'json', 'src'], {
      cwd: root,
      encoding: 'utf8',
    });
    const files: string[] = JSON.parse(r.stdout).map((f: any) => f.filePath);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => f.includes('__fixtures__'))).toEqual([]);
  });

  it('defines lint script and the husky/lint-staged wiring (criteria 7–9)', () => {
    expect(pkg.scripts['lint']).toBe('eslint . --max-warnings 0');
    expect(pkg.scripts['prepare']).toBe('husky');
    expect(pkg['lint-staged']).toEqual({
      '*.{ts,tsx,js}': ['eslint --max-warnings 0 --no-warn-ignored --fix', 'prettier --write'],
      '*.json': ['prettier --write'],
    });
    expect(read('.husky/pre-commit').trim()).toBe('npx lint-staged');
  });

  it('keeps the fixtures out of Prettier (criterion 4)', () => {
    expect(read('.prettierignore')).toContain('src/__fixtures__/');
  });

  it('runs lint as its own CI job that gates unit (criterion 6)', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toMatch(/\n  lint:\n[\s\S]*?- run: npm run lint\n/);
    expect(ci).toMatch(/needs: \[static-analysis, web-export, format-check, lint\]/);
  });

  it('lists the reformat commit for git blame (criterion 11)', () => {
    expect(existsSync(join(root, '.git-blame-ignore-revs'))).toBe(true);
    expect(read('.git-blame-ignore-revs')).toMatch(/^[0-9a-f]{40}$/m);
  });
});
