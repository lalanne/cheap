// Deliberately broken: used by src/tooling/__tests__/eslint.test.ts to
// prove ESLint rejects it. Excluded from lint and format (spec 015).
import { useEffect, useState } from 'react';

export function Bad({ id }: { id: string }) {
  const unused = 1;
  const [value, setValue] = useState('');
  useEffect(() => {
    setValue(id);
  }, []);
  return value;
}
