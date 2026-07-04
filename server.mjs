import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { homedir } from 'node:os';
import { buildBackupDocuments } from './src/journal-core.js';
import { createJournalStore } from './src/journal-store.js';
import {
  buildJsonResponseRequest,
  buildOpenRouterChatRequest,
  extractChatCompletionText,
  extractResponseText,
  normalizeModelComments,
  normalizeModelReadResponse,
  normalizeModelReply,
  parseModelJson,
  validateApiKey,
} from './src/openai-client.js';
import { loadLocalEnv } from './src/local-env.js';
import { chatInstructions, readResponseInstructions } from './src/model-prompts.js';

const root = process.cwd();
loadLocalEnv({ root });

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const journalRoot = process.env.INNER_NOTES_JOURNAL_ROOT || join(homedir(), 'Desktop', 'InnerNotes', 'journals');
const assetsRoot = join(journalRoot, 'assets');
const reviewRoot = join(journalRoot, '..', 'reviews');
const backupRoot = join(homedir(), 'Desktop', 'InnerNotesBackup');
const openAIResponsesUrl = 'https://api.openai.com/v1/responses';
const openRouterChatUrl = 'https://openrouter.ai/api/v1/chat/completions';
const defaultOpenAIModel = process.env.OPENAI_MODEL || 'gpt-5.5';
const defaultOpenRouterModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
const defaultOpenRouterFallbacks = 'google/gemini-2.5-flash';
const journalStore = await createJournalStore({ journalRoot, reviewRoot });

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 25_000_000) throw new Error('Payload too large');
  }
  return JSON.parse(raw || '{}');
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safePath(pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const clean = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, '');
  return join(root, clean);
}

async function handleStatic(req, res) {
  const file = safePath(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (!file.startsWith(root) || !existsSync(file)) {
    send(res, 404, 'Not found');
    return;
  }
  const data = await readFile(file);
  send(res, 200, data, contentTypes[extname(file)] || 'application/octet-stream');
}

function safeAssetPath(relativePath = '') {
  const clean = normalize(String(relativePath)).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  if (!clean || clean.includes('\0') || clean.startsWith('..')) {
    throw httpError(400, 'Invalid asset path');
  }
  const file = join(assetsRoot, clean);
  if (file !== assetsRoot && !file.startsWith(`${assetsRoot}${sep}`)) {
    throw httpError(400, 'Invalid asset path');
  }
  return { clean, file };
}

function imageExtension(mime = '') {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[String(mime).toLowerCase()] || '';
}

async function saveImageAsset(payload = {}) {
  const match = String(payload.dataUrl || '').match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw httpError(400, 'Only pasted png, jpg, webp, or gif images are supported.');
  const mime = match[1].toLowerCase();
  const extension = imageExtension(mime);
  if (!extension) throw httpError(400, 'Unsupported image type');

  const day = String(payload.entryId || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || new Date().toISOString().slice(0, 10);
  const entryPart = String(payload.entryId || day).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || day;
  const filename = `${entryPart}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const relativePath = join(day.slice(0, 4), day.slice(5, 7), filename);
  const { clean, file } = safeAssetPath(relativePath);

  await mkdir(join(assetsRoot, day.slice(0, 4), day.slice(5, 7)), { recursive: true });
  await writeFile(file, Buffer.from(match[2].replace(/\s/g, ''), 'base64'));

  return {
    path: file,
    src: `/api/assets?file=${encodeURIComponent(clean.replaceAll('\\', '/'))}`,
    type: mime,
  };
}

async function writeBackup(payload) {
  const documents = buildBackupDocuments(payload);
  await mkdir(join(backupRoot, 'daily'), { recursive: true });
  await mkdir(join(backupRoot, 'summaries'), { recursive: true });

  await writeFile(join(backupRoot, 'index.json'), JSON.stringify({
    updatedAt: new Date().toISOString(),
    entryCount: payload.entries?.length || 0,
    summaryCount: payload.summaries?.length || 0,
  }, null, 2));

  for (const item of documents.daily) {
    await writeFile(join(backupRoot, 'daily', `${item.id}.md`), item.markdown);
    await writeFile(join(backupRoot, 'daily', `${item.id}.json`), item.json);
  }

  for (const item of documents.summaries) {
    await writeFile(join(backupRoot, 'summaries', `${item.id}.md`), item.markdown);
    await writeFile(join(backupRoot, 'summaries', `${item.id}.json`), item.json);
  }

  return documents;
}

const replySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'text', 'reaction', 'thinking', 'conclusion'],
  properties: {
    mode: { type: 'string', enum: ['plain', 'structured'] },
    text: { type: 'string' },
    reaction: { type: ['string', 'null'] },
    thinking: { type: ['string', 'null'] },
    conclusion: { type: ['string', 'null'] },
  },
};

const commentsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['comments'],
  properties: {
    comments: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'anchor', 'text'],
        properties: {
          id: { type: 'string' },
          kind: { type: 'string', enum: ['obstacle', 'hidden-strength', 'small-action', 'question'] },
          anchor: { type: 'string' },
          text: { type: 'string' },
        },
      },
    },
  },
};

const readResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['response', 'quote', 'question', 'details'],
  properties: {
    response: { type: 'string' },
    quote: { type: ['string', 'null'] },
    question: { type: ['string', 'null'] },
    details: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
    },
  },
};

function slimEntry(entry = {}) {
  return {
    id: entry.id || '',
    title: entry.title || '',
    prompts: entry.prompts || {},
    body: entry.body || '',
  };
}

function slimMessages(messages = []) {
  return messages.slice(-8).map((message) => ({
    role: message.role,
    text: message.text || '',
  })).filter((message) => message.role && message.text);
}

function requireApiKey(name, options) {
  const value = process.env[name];
  if (!value) {
    throw httpError(503, `${name} is not set. Set it before starting the local server.`);
  }
  try {
    return validateApiKey(name, value, options);
  } catch (error) {
    throw httpError(400, error.message);
  }
}

async function callOpenAIJson({ instructions, payload, schemaName, schema }) {
  const apiKey = requireApiKey('OPENAI_API_KEY', { prefix: 'sk-' });

  const model = process.env.OPENAI_MODEL || defaultOpenAIModel;
  const requestBody = buildJsonResponseRequest({
    model,
    instructions,
    payload,
    schemaName,
    schema,
  });

  const response = await fetch(openAIResponsesUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || `OpenAI request failed with ${response.status}`);
  }

  return {
    source: 'openai',
    model,
    json: parseModelJson(extractResponseText(data)),
  };
}

function openRouterModelCandidates() {
  const primary = process.env.OPENROUTER_MODEL || defaultOpenRouterModel;
  const fallbacks = (process.env.OPENROUTER_MODEL_FALLBACKS || defaultOpenRouterFallbacks)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

function shouldTryOpenRouterFallback(error) {
  const message = String(error.message || '').toLowerCase();
  return error.status === 429
    || error.status >= 500
    || /not available|not found|region|provider|rate limit|overloaded|temporarily/i.test(message);
}

async function callOpenRouterModelJson({ model, instructions, payload, schemaName, schema, apiKey }) {
  const requestBody = buildOpenRouterChatRequest({
    model,
    instructions,
    payload,
    schemaName,
    schema,
  });

  const response = await fetch(openRouterChatUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': `http://localhost:${port}`,
      'X-Title': 'Inner Notes',
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw httpError(response.status, data.error?.message || `OpenRouter request failed with ${response.status}`);
  }

  return {
    source: 'openrouter',
    model,
    json: parseModelJson(extractChatCompletionText(data)),
  };
}

async function callOpenRouterJson(args) {
  const apiKey = requireApiKey('OPENROUTER_API_KEY', { prefix: 'sk-or-' });
  const models = openRouterModelCandidates();
  const errors = [];

  for (const model of models) {
    try {
      return await callOpenRouterModelJson({ ...args, model, apiKey });
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
      if (!shouldTryOpenRouterFallback(error)) {
        throw error;
      }
    }
  }

  throw httpError(502, `OpenRouter models failed: ${errors.join('; ')}`);
}

async function callModelJson(args) {
  if (process.env.MODEL_PROVIDER === 'openai') return callOpenAIJson(args);
  if (process.env.OPENROUTER_API_KEY) return callOpenRouterJson(args);
  if (process.env.OPENAI_API_KEY) return callOpenAIJson(args);
  throw httpError(503, 'OPENROUTER_API_KEY or OPENAI_API_KEY is not set. Set one before starting the local server.');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/health')) {
      sendJson(res, 200, {
        ok: true,
        storage: journalStore.kind,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/backup') {
      const payload = await readJson(req);
      const documents = await writeBackup(payload);
      sendJson(res, 200, {
        ok: true,
        folder: backupRoot,
        dailyCount: documents.daily.length,
        summaryCount: documents.summaries.length,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/assets') {
      const payload = await readJson(req);
      const asset = await saveImageAsset(payload);
      sendJson(res, 200, {
        ok: true,
        src: asset.src,
        path: asset.path,
        type: asset.type,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/assets') {
      const { file } = safeAssetPath(url.searchParams.get('file') || '');
      if (!existsSync(file)) {
        send(res, 404, 'Not found');
        return;
      }
      const data = await readFile(file);
      send(res, 200, data, contentTypes[extname(file).toLowerCase()] || 'application/octet-stream');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/journals') {
      const entries = await journalStore.readEntries();
      const summaries = await journalStore.readSummaries();
      sendJson(res, 200, {
        ok: true,
        folder: journalStore.folder,
        entries,
        summaries,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/journals') {
      const payload = await readJson(req);
      const results = await journalStore.saveEntries(payload.entries || []);
      sendJson(res, 200, {
        ok: true,
        folder: journalStore.folder,
        count: results.length,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/journal-entry') {
      const payload = await readJson(req);
      if (!payload.entry?.id) throw httpError(400, 'entry.id is required');
      const result = await journalStore.saveEntry(payload.entry);
      sendJson(res, 200, {
        ok: true,
        folder: journalStore.folder,
        markdownPath: result.markdownPath,
        jsonPath: result.jsonPath,
      });
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/journal-entry') {
      const id = url.searchParams.get('id');
      if (!id) throw httpError(400, 'id is required');
      const result = await journalStore.deleteEntry(id);
      sendJson(res, 200, {
        ok: true,
        folder: journalStore.folder,
        ...result,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/model-reply') {
      const payload = await readJson(req);
      const result = await callModelJson({
        instructions: chatInstructions,
        payload: {
          userInput: payload.userInput || '',
          entry: slimEntry(payload.entry),
          recentMessages: slimMessages(payload.recentMessages || []),
        },
        schemaName: 'inner_notes_reply',
        schema: replySchema,
      });
      sendJson(res, 200, {
        ok: true,
        source: result.source,
        model: result.model,
        reply: normalizeModelReply(result.json),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/model-read-response') {
      const payload = await readJson(req);
      const entry = slimEntry(payload.entry);
      const result = await callModelJson({
        instructions: readResponseInstructions,
        payload: {
          entry,
          history: (payload.history || []).slice(0, 5).map(slimEntry),
        },
        schemaName: 'inner_notes_read_response',
        schema: readResponseSchema,
      });
      sendJson(res, 200, {
        ok: true,
        source: result.source,
        model: result.model,
        readResponse: normalizeModelReadResponse(result.json, entry.body),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/model-comments') {
      const payload = await readJson(req);
      const entry = slimEntry(payload.entry);
      const result = await callModelJson({
        instructions: readResponseInstructions,
        payload: {
          entry,
          history: (payload.history || []).slice(0, 5).map(slimEntry),
        },
        schemaName: 'inner_notes_read_response',
        schema: readResponseSchema,
      });
      sendJson(res, 200, {
        ok: true,
        source: result.source,
        model: result.model,
        readResponse: normalizeModelReadResponse(result.json, entry.body),
        comments: normalizeModelComments({ comments: [] }, entry.body),
      });
      return;
    }

    if (req.method === 'GET') {
      await handleStatic(req, res);
      return;
    }

    send(res, 405, 'Method not allowed');
  } catch (error) {
    sendJson(res, error.status || 500, {
      ok: false,
      error: error.message,
    });
  }
});

server.listen(port, host, async () => {
  await mkdir(journalRoot, { recursive: true });
  await mkdir(assetsRoot, { recursive: true });
  await mkdir(backupRoot, { recursive: true });
  console.log(`Inner Notes is running at http://${host}:${port}`);
  console.log(`Storage: ${journalStore.kind}`);
  console.log(`Journal folder: ${journalStore.folder}`);
  console.log(`Desktop backup folder: ${backupRoot}`);
});
