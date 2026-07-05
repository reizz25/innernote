import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeEntry,
  buildCompanionReply,
  buildBackupDocuments,
  commentDisplayItems,
  createEntryForDate,
  dedupeRetainedConversations,
  ensureEntryForDate,
  generateMonthlySummary,
  generateAutomaticSummaries,
  generateWeeklySummary,
  retainedConversationPreview,
  retainConversation,
  summarizeConversation,
  deleteCommentById,
  deleteEntryById,
  deleteRetainedConversationById,
} from '../src/journal-core.js';

test('ensureEntryForDate creates a day entry from the first record time', () => {
  const entries = [];
  const now = new Date('2026-06-02T21:46:00+08:00');

  const result = ensureEntryForDate(entries, now);

  assert.equal(result.entry.id, '2026-06-02');
  assert.equal(result.entry.firstRecordedAt, '2026-06-02T13:46:00.000Z');
  assert.equal(result.entry.title, '今天想记下什么？');
  assert.equal(result.entries.length, 1);
});

test('ensureEntryForDate reuses the existing entry for the same local date', () => {
  const first = ensureEntryForDate([], new Date('2026-06-02T09:00:00+08:00'));
  const second = ensureEntryForDate(first.entries, new Date('2026-06-02T23:30:00+08:00'));

  assert.equal(second.entries.length, 1);
  assert.equal(second.entry.firstRecordedAt, '2026-06-02T01:00:00.000Z');
});

test('createEntryForDate allows multiple entries on the same local day', () => {
  const first = createEntryForDate([], new Date('2026-06-02T09:15:30+08:00'), 'Asia/Shanghai');
  const second = createEntryForDate(first.entries, new Date('2026-06-02T23:30:00+08:00'), 'Asia/Shanghai');
  const third = createEntryForDate(second.entries, new Date('2026-06-02T23:30:00+08:00'), 'Asia/Shanghai');

  assert.equal(first.entry.id, '2026-06-02-091530');
  assert.equal(second.entry.id, '2026-06-02-233000');
  assert.equal(third.entry.id, '2026-06-02-233000-02');
  assert.equal(third.entries.length, 3);
  assert.equal(new Set(third.entries.map((entry) => entry.id)).size, 3);
});

test('analyzeEntry names obstacles, hidden strengths, and small actions', () => {
  const entry = {
    id: '2026-06-02',
    body: '下午消息一多，我又开始觉得自己什么都没做好。我把还没回复和我不可靠联系起来。晚上散步之后好了一些。',
    prompts: {},
  };

  const comments = analyzeEntry(entry, []);

  assert.equal(comments.length, 3);
  assert.equal(comments[0].kind, 'obstacle');
  assert.match(comments[0].text, /期待|消息|揽到自己身上/);
  assert.equal(comments[1].kind, 'hidden-strength');
  assert.match(comments[1].text, /敏感|共情|判断力/);
  assert.equal(comments[2].kind, 'small-action');
  assert.match(comments[2].text, /集中回复|重要/);
});

test('analyzeEntry does not force comments on low-signal text', () => {
  const comments = analyzeEntry({
    id: '2026-06-08',
    body: '你好，这是测试日记',
    prompts: {},
  }, []);

  assert.deepEqual(comments, []);
});

test('summarizeConversation keeps the discussion as a concise memory', () => {
  const messages = [
    { role: 'user', text: '我发现自己一看到消息就紧张。' },
    { role: 'assistant', text: '这可能不是懒，而是你把回复速度等同于可靠。' },
    { role: 'user', text: '这个值得留下来。' },
  ];

  const summary = summarizeConversation(messages);

  assert.match(summary.title, /消息|讨论/);
  assert.match(summary.summary, /紧张|可靠|回复/);
  assert.equal(summary.messages.length, 3);
});

test('buildCompanionReply returns reaction, visible reasoning summary, and conclusion', () => {
  const reply = buildCompanionReply('我今天收到很多消息就很紧张，觉得自己不可靠。', {
    body: '今天消息很多。',
  });

  assert.match(reply.reaction, /听见|直接/);
  assert.match(reply.thinking, /消息|可靠/);
  assert.match(reply.conclusion, /回复|重要/);
  assert.match(reply.text, /反应/);
  assert.match(reply.text, /我在想/);
  assert.match(reply.text, /结论/);
});

test('buildCompanionReply can continue the conversation with a choice prompt', () => {
  const reply = buildCompanionReply('你帮我看看障碍还是优点？', { body: '' });

  assert.match(reply.reaction, /可以|我在/);
  assert.match(reply.conclusion, /障碍|优点/);
});

test('buildCompanionReply answers a greeting as a plain lightweight reply', () => {
  const reply = buildCompanionReply('你好', { body: '' });

  assert.equal(reply.mode, 'plain');
  assert.equal(reply.text, '你好，我在。');
  assert.equal(reply.reaction, undefined);
  assert.equal(reply.thinking, undefined);
  assert.equal(reply.conclusion, undefined);
});

test('summarizeConversation treats very short greetings as a start, not an insight', () => {
  const summary = summarizeConversation([
    { role: 'user', text: '你好' },
    { role: 'assistant', text: '你好，我在。' },
  ]);

  assert.equal(summary.title, '一次简短问候');
  assert.match(summary.summary, /太短|开始记录/);
  assert.doesNotMatch(summary.summary, /线索：你好/);
});

test('retainConversation deduplicates the same saved discussion', () => {
  const messages = [
    { role: 'user', text: '我发现自己一看到消息就紧张。' },
    { role: 'assistant', text: '这可能不是懒，而是你把回复速度等同于可靠。' },
  ];

  const first = retainConversation([], messages, new Date('2026-06-08T02:00:00+08:00'));
  const second = retainConversation(first, messages, new Date('2026-06-08T02:05:00+08:00'));

  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.match(second[0].summary, /回复速度|可靠/);
});

test('retainConversation skips greetings and model setup messages', () => {
  const retained = retainConversation([], [
    { role: 'user', text: '你好' },
    { role: 'assistant', text: '模型还没接上：请先设置 OPENROUTER_API_KEY。', source: 'system' },
  ], new Date('2026-06-08T02:00:00+08:00'));

  assert.deepEqual(retained, []);
});

test('dedupeRetainedConversations removes repeated older saved discussions', () => {
  const messages = [
    { role: 'user', text: '我一看到消息就紧张，会觉得自己不可靠。' },
    { role: 'assistant', text: '这里可能是你把回复速度和可靠感绑在一起了。' },
  ];
  const first = summarizeConversation(messages);
  const second = { ...summarizeConversation(messages), id: 'older-copy' };

  const retained = dedupeRetainedConversations([first, second]);

  assert.equal(retained.length, 1);
  assert.equal(retained[0].id, first.id);
});

test('dedupeRetainedConversations removes low-value saved discussions', () => {
  const retained = dedupeRetainedConversations([{
    id: 'old-greeting',
    title: '一次简短问候',
    summary: '这段讨论内容还太短，先作为开始记录保留，不急着提炼模式。',
    messages: [
      { role: 'user', text: '你好' },
      { role: 'assistant', text: '你好，我在。' },
    ],
  }]);

  assert.deepEqual(retained, []);
});

test('dedupeRetainedConversations refreshes old low-signal summaries', () => {
  const retained = dedupeRetainedConversations([{
    id: 'old-greeting',
    title: '值得留下的讨论',
    summary: '这段讨论保留了一个线索：你好',
    messages: [
      { role: 'user', text: '你好' },
      { role: 'assistant', text: '你好，我在。' },
    ],
  }]);

  assert.deepEqual(retained, []);
});

test('retainedConversationPreview formats a compact document transcript', () => {
  const memory = summarizeConversation([
    { role: 'user', text: '我：今天有点烦。' },
    { role: 'assistant', text: '我先不安慰你，烦可能是在提醒你边界被碰到了。' },
    { role: 'user', text: '这个值得留下。' },
  ]);

  const preview = retainedConversationPreview(memory);

  assert.equal(preview.title, memory.title);
  assert.equal(preview.lines[0].speaker, '我');
  assert.match(preview.lines[0].text, /今天有点烦/);
  assert.equal(preview.lines[1].speaker, '你的回复');
  assert.match(preview.lines[1].text, /边界/);
});

test('generateWeeklySummary extracts recurring patterns from entries in the same week', () => {
  const entries = [
    { id: '2026-06-01', body: '消息太多时我会自责，但散步有帮助。', prompts: { mood: '紧' } },
    { id: '2026-06-02', body: '没回复消息时，我觉得自己不可靠。晚上散步后恢复。', prompts: { mood: '紧' } },
    { id: '2026-05-27', body: '这是上周。', prompts: {} },
  ];

  const summary = generateWeeklySummary(entries, new Date('2026-06-02T12:00:00+08:00'));

  assert.equal(summary.id, 'week-2026-06-01');
  assert.equal(summary.entryCount, 2);
  assert.match(summary.patterns.join(' '), /消息/);
  assert.match(summary.recovery.join(' '), /散步/);
});

test('generateMonthlySummary includes entries from the same month', () => {
  const entries = [
    { id: '2026-06-01', body: '消息和自责。', prompts: {} },
    { id: '2026-06-15', body: '重要的事先做。', prompts: {} },
    { id: '2026-05-31', body: '五月。', prompts: {} },
  ];

  const summary = generateMonthlySummary(entries, new Date('2026-06-20T12:00:00+08:00'));

  assert.equal(summary.id, 'month-2026-06');
  assert.equal(summary.entryCount, 2);
  assert.match(summary.summary, /这个月|2 天/);
});

test('generateAutomaticSummaries keeps saved reviews instead of creating a lightweight weekly summary', () => {
  const entries = [
    { id: '2026-06-01', body: '消息太多时我会自责，但散步有帮助。', prompts: {} },
    { id: '2026-06-03', body: '', prompts: {} },
    { id: '2026-06-24', body: '消息很多，我回复之后还是会自责。', prompts: {} },
    { id: '2026-06-25', body: '今天也在处理消息，想把回复集中到固定窗口。', prompts: {} },
    { id: '2026-07-01', body: '本周还没结束，先不生成回顾。', prompts: {} },
  ];
  const saved = [{
    id: 'week-2026-06-01',
    type: 'week',
    summary: '这是 Codex 写回的正式回顾。',
  }];

  const summaries = generateAutomaticSummaries(entries, saved, new Date('2026-07-02T12:00:00+08:00'));

  assert.deepEqual(summaries, saved);
  assert.doesNotMatch(JSON.stringify(summaries), /本周共记录|week-2026-06-22/);
});

test('generateAutomaticSummaries does not create summaries when nothing meaningful was written', () => {
  const summaries = generateAutomaticSummaries([
    { id: '2026-06-01', body: '', prompts: {} },
    { id: '2026-06-02', body: '你好，这是测试日记', prompts: {} },
  ], []);

  assert.deepEqual(summaries, []);
});

test('buildBackupDocuments creates markdown and json documents for desktop backup', () => {
  const entry = {
    id: '2026-06-02',
    firstRecordedAt: '2026-06-02T13:46:00.000Z',
    updatedAt: '2026-06-02T14:00:00.000Z',
    title: '今天想记下什么？',
    prompts: { mood: '紧', energy: '下午下降', tomorrow: '先做重要的事' },
    body: '今天消息很多。',
    comments: [{ kind: 'obstacle', text: '消息是触发点。' }],
    retainedConversations: [{ title: '关于消息的讨论', summary: '回复消息让你紧张。' }],
  };

  const docs = buildBackupDocuments({ entries: [entry], summaries: [] });

  assert.equal(docs.daily.length, 1);
  assert.equal(docs.daily[0].id, '2026-06-02');
  assert.match(docs.daily[0].markdown, /# 2026-06-02/);
  assert.match(docs.daily[0].markdown, /关于消息的讨论/);
  assert.match(docs.daily[0].markdown, /你的回复|总结/);
  assert.match(docs.daily[0].json, /"firstRecordedAt"/);
});

test('commentDisplayItems exposes quoted text for Feishu-style side comments', () => {
  const comments = [
    { id: 'obstacle-messages', kind: 'obstacle', role: '像好友', anchor: '测试一下', text: '这里可能有个障碍。' },
    { id: 'action-batch-reply', kind: 'small-action', role: '像教练', anchor: '明天', text: '明天先做一件重要的事。' },
  ];

  const displayItems = commentDisplayItems(comments);

  assert.deepEqual(displayItems.map((item) => item.label), ['评论 1', '评论 2']);
  assert.deepEqual(displayItems.map((item) => item.quote), ['测试一下', '明天']);
  assert.equal(displayItems[0].role, undefined);
  assert.equal(displayItems[0].domId, 'comment-obstacle-messages');
  assert.equal(displayItems[0].highlightId, 'highlight-obstacle-messages');
  assert.equal(displayItems[1].anchor, '明天');
});

test('backup markdown does not expose persona role labels in comments', () => {
  const docs = buildBackupDocuments({
    entries: [{
      id: '2026-06-02',
      title: '今天想记下什么？',
      firstRecordedAt: '2026-06-02T13:46:00.000Z',
      updatedAt: '2026-06-02T14:00:00.000Z',
      prompts: {},
      body: '测试一下',
      comments: [{ kind: 'obstacle', role: '像好友', text: '这里可能有个障碍。' }],
      retainedConversations: [],
    }],
    summaries: [],
  });

  assert.match(docs.daily[0].markdown, /评论 1/);
  assert.doesNotMatch(docs.daily[0].markdown, /像好友|像教练|像家人/);
  assert.doesNotMatch(docs.daily[0].json, /像好友|像教练|像家人/);
});

test('delete helpers remove entries, comments, and retained discussions by id', () => {
  const entries = [
    {
      id: '2026-06-08',
      comments: [{ id: 'keep' }, { id: 'remove-me' }],
      retainedConversations: [{ id: 'memory-1' }, { id: 'memory-2' }],
    },
    { id: '2026-06-02', comments: [], retainedConversations: [] },
  ];

  assert.deepEqual(deleteEntryById(entries, '2026-06-02').map((entry) => entry.id), ['2026-06-08']);
  assert.deepEqual(deleteCommentById(entries[0], 'remove-me').comments.map((comment) => comment.id), ['keep']);
  assert.deepEqual(deleteRetainedConversationById(entries[0], 'memory-1').retainedConversations.map((item) => item.id), ['memory-2']);
});
