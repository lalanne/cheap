// Spec 015, criteria 3–4: the formatter's config, scope and scripts.
import { execFileSync, spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');
const prettier = join(root, 'node_modules', '.bin', 'prettier');
const config = join(root, '.prettierrc');

const run = (...args: string[]) =>
  spawnSync(prettier, ['--config', config, ...args], { cwd: root, encoding: 'utf8' });

const ignored = (path: string): boolean =>
  JSON.parse(execFileSync(prettier, ['--file-info', path], { cwd: root, encoding: 'utf8' }))
    .ignored;

describe('prettier setup (spec 015)', () => {
  it('sets singleQuote and printWidth 100 (criterion 4)', () => {
    expect(JSON.parse(readFileSync(config, 'utf8'))).toEqual({
      singleQuote: true,
      printWidth: 100,
    });
  });

  it('exposes format and format:check scripts (criterion 3)', () => {
    const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(scripts['format']).toBe('prettier --write .');
    expect(scripts['format:check']).toBe('prettier --check .');
  });

  it.each([
    'specs/README.md',
    'README.md',
    'CLAUDE.md',
    '.github/workflows/ci.yml',
    'package-lock.json',
    'coverage/coverage-summary.json',
    'dist/index.html',
    '.expo/settings.json',
  ])('does not touch %s (criterion 4)', (path) => {
    expect(ignored(path)).toBe(true);
  });

  it.each(['App.tsx', 'src/auth/store.ts', 'jest.config.js', 'app.json'])(
    'covers %s (criterion 4)',
    (path) => {
      expect(ignored(path)).toBe(false);
    },
  );

  it('fails --check on an unformatted file and --write fixes it (criterion 3)', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'prettier-')), 'bad.ts');
    writeFileSync(file, 'const a = "x"\nconst   b = {c:1}\n');

    const before = run('--check', file);
    expect(before.status).not.toBe(0);
    expect(before.stderr).toContain('bad.ts');

    expect(run('--write', file).status).toBe(0);
    expect(readFileSync(file, 'utf8')).toBe("const a = 'x';\nconst b = { c: 1 };\n");
    expect(run('--check', file).status).toBe(0);
  });
});
