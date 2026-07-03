import test from 'node:test';
import assert from 'node:assert/strict';

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
} from '../src/openai-client.js';

test('buildJsonResponseRequest creates a Responses API JSON schema request', () => {
  const request = buildJsonResponseRequest({
    model: 'gpt-test',
    instructions: 'Return JSON.',
    payload: { userInput: '你好' },
    schemaName: 'inner_notes_reply',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: { text: { type: 'string' } },
    },
  });

  assert.equal(request.model, 'gpt-test');
  assert.equal(request.instructions, 'Return JSON.');
  assert.equal(request.input, '{"userInput":"你好"}');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.text.format.name, 'inner_notes_reply');
  assert.equal(request.text.format.strict, true);
});

test('buildOpenRouterChatRequest creates a chat completions JSON schema request', () => {
  const request = buildOpenRouterChatRequest({
    model: 'openai/gpt-test',
    instructions: 'Return JSON.',
    payload: { userInput: '你好' },
    schemaName: 'inner_notes_reply',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: { text: { type: 'string' } },
    },
  });

  assert.equal(request.model, 'openai/gpt-test');
  assert.equal(request.messages[0].role, 'system');
  assert.equal(request.messages[0].content, 'Return JSON.');
  assert.equal(request.messages[1].role, 'user');
  assert.equal(request.messages[1].content, '{"userInput":"你好"}');
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.response_format.json_schema.name, 'inner_notes_reply');
  assert.equal(request.response_format.json_schema.strict, true);
});

test('extractResponseText supports output_text and output message content', () => {
  assert.equal(extractResponseText({ output_text: '{"ok":true}' }), '{"ok":true}');
  assert.equal(extractResponseText({
    output: [{
      content: [{ type: 'output_text', text: '{"ok":true}' }],
    }],
  }), '{"ok":true}');
});

test('extractChatCompletionText supports OpenAI-compatible chat completions', () => {
  assert.equal(extractChatCompletionText({
    choices: [{
      message: { content: '{"ok":true}' },
    }],
  }), '{"ok":true}');
});

test('validateApiKey rejects placeholders and non-ascii values before fetch headers are built', () => {
  assert.equal(validateApiKey('OPENROUTER_API_KEY', ' sk-or-v1-valid ', { prefix: 'sk-or-' }), 'sk-or-v1-valid');
  assert.throws(
    () => validateApiKey('OPENROUTER_API_KEY', '你的OpenRouter新key', { prefix: 'sk-or-' }),
    /contains placeholder text/,
  );
  assert.throws(
    () => validateApiKey('OPENROUTER_API_KEY', 'sk-or-v1-你好', { prefix: 'sk-or-' }),
    /contains non-ASCII/,
  );
  assert.throws(
    () => validateApiKey('OPENROUTER_API_KEY', 'sk-wrong', { prefix: 'sk-or-' }),
    /should start with sk-or-/,
  );
});

test('parseModelJson extracts strict JSON from model text', () => {
  assert.deepEqual(parseModelJson('{"text":"你好"}'), { text: '你好' });
  assert.deepEqual(parseModelJson('```json\n{"text":"你好"}\n```'), { text: '你好' });
  assert.throws(() => parseModelJson('not json'), /valid JSON/);
});

test('normalizeModelReply keeps greetings plain and substantive replies structured', () => {
  assert.deepEqual(normalizeModelReply({ mode: 'plain', text: '你好，我在。' }), {
    mode: 'plain',
    text: '你好，我在。',
  });

  const structured = normalizeModelReply({
    mode: 'structured',
    text: '',
    reaction: '我听见了。',
    thinking: '这里是给用户看的判断摘要。',
    conclusion: '先做一个小动作。',
  });

  assert.equal(structured.mode, 'structured');
  assert.match(structured.text, /反应/);
  assert.match(structured.text, /我听见了/);
  assert.match(structured.text, /小动作/);
});

test('normalizeModelComments filters invalid comments and keeps exact anchors', () => {
  const comments = normalizeModelComments({
    comments: [
      { kind: 'obstacle', anchor: '我很累', text: '身体信号值得看。' },
      { kind: 'noise', anchor: '不存在', text: '' },
    ],
  }, '今天我很累。');

  assert.equal(comments.length, 1);
  assert.equal(comments[0].id, 'model-comment-1');
  assert.equal(comments[0].kind, 'obstacle');
  assert.equal(comments[0].anchor, '我很累');
});

test('normalizeModelReadResponse keeps one response with optional quote and folded details', () => {
  const reply = normalizeModelReadResponse({
    response: '我读到你其实已经有点累了，但还是很难把自己放在前面。这不像简单的不懂拒绝，更像一个熟练的自动反应。',
    quote: '我就很难先照顾自己',
    question: '要不要继续说说，为什么先顾自己会让你觉得自私？',
    details: [
      '你有很强的照看能力，但它可能启动得太快。',
      '',
      '真正值得看的不是要不要帮别人，而是你有没有先消失。',
      '多余细节 1',
    ],
  }, '好像只要别人需要我，我就很难先照顾自己。');

  assert.match(reply.response, /已经有点累/);
  assert.equal(reply.quote, '我就很难先照顾自己');
  assert.match(reply.question, /自私/);
  assert.deepEqual(reply.details, [
    '你有很强的照看能力，但它可能启动得太快。',
    '真正值得看的不是要不要帮别人，而是你有没有先消失。',
    '多余细节 1',
  ]);
});
