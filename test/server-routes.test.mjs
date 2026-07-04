import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('server exposes both API and platform health check paths', async () => {
  const source = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

  assert.match(source, /url\.pathname === '\/api\/health'/);
  assert.match(source, /url\.pathname === '\/health'/);
});
