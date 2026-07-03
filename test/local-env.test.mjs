import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadLocalEnv } from '../src/local-env.js';

test('loadLocalEnv reads .env.local without overriding existing environment values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inner-notes-env-'));
  try {
    await writeFile(join(root, '.env.local'), [
      '# local secrets',
      'OPENROUTER_API_KEY="sk-or-v1-from-file"',
      'OPENROUTER_MODEL=openai/gpt-5.2',
      'export INNER_NOTES_PROXY=http://127.0.0.1:7897',
      '',
    ].join('\n'));

    const env = {
      OPENROUTER_MODEL: 'already-set-model',
    };
    const loaded = loadLocalEnv({ root, env });

    assert.equal(env.OPENROUTER_API_KEY, 'sk-or-v1-from-file');
    assert.equal(env.OPENROUTER_MODEL, 'already-set-model');
    assert.equal(env.INNER_NOTES_PROXY, 'http://127.0.0.1:7897');
    assert.deepEqual(loaded.loadedKeys.sort(), ['INNER_NOTES_PROXY', 'OPENROUTER_API_KEY']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
