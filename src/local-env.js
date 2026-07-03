import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function stripQuotes(value = '') {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEnvLines(text = '') {
  const values = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator <= 0) continue;
    const key = normalized.slice(0, separator).trim();
    const value = stripQuotes(normalized.slice(separator + 1));
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) values[key] = value;
  }
  return values;
}

export function loadLocalEnv({ root = process.cwd(), env = process.env, fileName = '.env.local' } = {}) {
  const file = join(root, fileName);
  if (!existsSync(file)) return { file, loadedKeys: [] };

  const values = parseEnvLines(readFileSync(file, 'utf8'));
  const loadedKeys = [];
  for (const [key, value] of Object.entries(values)) {
    if (env[key]) continue;
    env[key] = value;
    loadedKeys.push(key);
  }

  return { file, loadedKeys };
}
