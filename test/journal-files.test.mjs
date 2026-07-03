import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  deleteJournalEntryFiles,
  readJournalEntries,
  readReviewSummaries,
  saveJournalEntry,
} from '../src/journal-files.js';

test('saveJournalEntry writes readable markdown and metadata json by date path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inner-notes-files-'));
  try {
    const entry = {
      id: '2026-06-15',
      title: '今天想记下什么？',
      firstRecordedAt: '2026-06-15T14:18:00.000Z',
      updatedAt: '2026-06-15T14:20:00.000Z',
      prompts: {
        mood: ['平静', '不安'],
        energy: '能量不足',
        metrics: { weight: '62.5', sleep: '7.5', phone: '3' },
        exercises: {
          hip: {
            'pelvic-tilt': true,
            'glute-bridge': false,
          },
        },
        todos: [
          { id: 'todo-1', text: '找一段不被打断的时间，先做自己的事。', done: false },
          { id: 'todo-2', text: '睡前少看手机。', done: true },
        ],
        tomorrow: { done: false, text: '找一段不被打断的时间，先做自己的事。\n睡前少看手机。' },
      },
      body: [
        '今天下午我本来想休息，但还是忍不住去处理别人的事。',
        '',
        '我嘴上说没关系，其实心里有一点烦。',
      ].join('\n'),
      readResponse: {
        response: '我读到你其实已经有点累了。',
        quote: '我嘴上说没关系',
        question: '为什么先顾自己会让你觉得自私？',
        details: ['你很会照看别人。'],
      },
      retainedConversations: [{
        id: 'conversation-1',
        title: '关于先顾自己的讨论',
        summary: '先顾自己不等于不在乎别人。',
        messages: [
          { role: 'user', text: '我怕如果我先顾自己，会显得很自私。' },
          { role: 'assistant', text: '你可能把先照顾自己和不在乎别人绑在一起了。' },
        ],
      }],
    };

    const result = await saveJournalEntry(root, entry);
    assert.equal(result.markdownPath, join(root, '2026', '06', '2026-06-15.md'));
    assert.equal(result.jsonPath, join(root, '2026', '06', '2026-06-15.json'));

    const markdown = await readFile(result.markdownPath, 'utf8');
    assert.match(markdown, /date: 2026-06-15/);
    assert.match(markdown, /moods: \["平静","不安"\]/);
    assert.match(markdown, /weight: "62.5"/);
    assert.match(markdown, /sleep: "7.5"/);
    assert.match(markdown, /phone: "3"/);
    assert.match(markdown, /exercises:/);
    assert.match(markdown, /group: "髋关节系统锻炼"/);
    assert.match(markdown, /label: "骨盆前后倾（10次）"/);
    assert.match(markdown, /label: "屈膝左右倒（左右各8次）"/);
    assert.match(markdown, /done: true/);
    assert.match(markdown, /todos:/);
    assert.match(markdown, /text: "找一段不被打断的时间，先做自己的事。"/);
    assert.match(markdown, /done: true/);
    assert.match(markdown, /今天下午我本来想休息/);
    assert.doesNotMatch(markdown, /"updatedAt"/);

    const metadata = JSON.parse(await readFile(result.jsonPath, 'utf8'));
    assert.equal(metadata.id, '2026-06-15');
    assert.equal(metadata.prompts.metrics.sleep, '7.5');
    assert.equal(metadata.prompts.todos[1].done, true);
    assert.equal(metadata.prompts.tomorrow.text, '找一段不被打断的时间，先做自己的事。\n睡前少看手机。');
    assert.match(metadata.readResponse.response, /有点累/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('readReviewSummaries loads weekly review files for the app sidebar', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inner-notes-reviews-'));
  try {
    await mkdir(join(root, 'weekly'), { recursive: true });
    await writeFile(join(root, 'weekly', '2026-W26.json'), JSON.stringify({
      type: 'weekly-review',
      period: {
        id: '2026-W26',
        start: '2026-06-22T00:00:00+08:00',
        end: '2026-06-28T23:59:59+08:00',
      },
      entryCount: 4,
      generatedAt: '2026-07-01T00:00:00+08:00',
      review: {
        overview: '这一周的主线是工作去向和表达边界。',
        patterns: ['职业去向的焦虑已经落在具体问题上。'],
        observationQuestion: '这句话是事实、求证、判断，还是情绪？',
        smallAction: '列 3 个 AI 相关案例标题。',
      },
    }), 'utf8');

    const summaries = await readReviewSummaries(root);

    assert.deepEqual(summaries.map((summary) => summary.id), ['week-2026-06-22']);
    assert.equal(summaries[0].type, 'week');
    assert.equal(summaries[0].range, '2026-06-22 至 2026-06-28');
    assert.equal(summaries[0].entryCount, 4);
    assert.equal(summaries[0].summary, '这一周的主线是工作去向和表达边界。');
    assert.deepEqual(summaries[0].patterns, ['职业去向的焦虑已经落在具体问题上。']);
    assert.deepEqual(summaries[0].nextActions, ['这句话是事实、求证、判断，还是情绪？', '列 3 个 AI 相关案例标题。']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('readJournalEntries scans metadata files and deleteJournalEntryFiles removes both files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inner-notes-files-'));
  try {
    await saveJournalEntry(root, {
      id: '2026-06-14',
      firstRecordedAt: '2026-06-14T15:02:00.000Z',
      updatedAt: '2026-06-14T15:04:00.000Z',
      prompts: {},
      body: '想明白了一件小事。',
    });
    await saveJournalEntry(root, {
      id: '2026-06-15',
      firstRecordedAt: '2026-06-15T14:18:00.000Z',
      updatedAt: '2026-06-15T14:20:00.000Z',
      prompts: {},
      body: '有点累，但写下来了。',
    });

    const entries = await readJournalEntries(root);
    assert.deepEqual(entries.map((entry) => entry.id), ['2026-06-15', '2026-06-14']);

    const deleted = await deleteJournalEntryFiles(root, '2026-06-15');
    assert.equal(deleted.markdownDeleted, true);
    assert.equal(deleted.jsonDeleted, true);

    const remaining = await readJournalEntries(root);
    assert.deepEqual(remaining.map((entry) => entry.id), ['2026-06-14']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
