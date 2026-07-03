import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const EXERCISE_GROUPS = [{
  id: 'hip',
  title: '髋关节系统锻炼',
  items: [
    { id: 'pelvic-tilt', label: '骨盆前后倾（10次）' },
    { id: 'glute-bridge', label: '臀桥（10次 × 2组）' },
    { id: 'heel-slide', label: '脚跟滑动（左右各8次）' },
    { id: 'bent-knee-fallout', label: '屈膝左右倒（左右各8次）' },
    { id: 'clam-shell', label: '蚌式开合（左右各10次）' },
  ],
}];

function parseEntryId(id = '') {
  const [year, month, day] = String(id).split('-').map(Number);
  if (!year || !month || !day) throw new Error(`Invalid journal entry id: ${id}`);
  return { year, month, day };
}

function entryDir(root, id) {
  const { year, month } = parseEntryId(id);
  return join(root, String(year), String(month).padStart(2, '0'));
}

function entryPaths(root, id) {
  const dir = entryDir(root, id);
  return {
    dir,
    markdownPath: join(dir, `${id}.md`),
    jsonPath: join(dir, `${id}.json`),
  };
}

function weekdayForId(id) {
  const { year, month, day } = parseEntryId(id);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function formatTime(iso = '') {
  if (!iso) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Shanghai',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function normalizeMoods(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(/[,\s，、#]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTomorrow(value) {
  if (value && typeof value === 'object') {
    return {
      done: Boolean(value.done),
      text: String(value.text || ''),
    };
  }
  return {
    done: false,
    text: String(value || ''),
  };
}

function normalizeMetrics(value) {
  if (!value || typeof value !== 'object') {
    return { weight: '', sleep: '', phone: '' };
  }
  return {
    weight: String(value.weight || ''),
    sleep: String(value.sleep || ''),
    phone: String(value.phone || ''),
  };
}

function normalizeTodos(value, tomorrow = {}) {
  if (Array.isArray(value)) {
    return value
      .map((item, index) => ({
        id: String(item.id || `todo-${index}`),
        text: String(item.text || '').trim(),
        done: Boolean(item.done),
      }))
      .filter((item) => item.text || item.done);
  }
  const legacyText = String(tomorrow.text || '').trim();
  if (!legacyText) return [];
  return legacyText.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `legacy-tomorrow-${index}`,
      text,
      done: Boolean(tomorrow.done),
    }));
}

function exerciseFrontmatter(value = {}) {
  return EXERCISE_GROUPS.flatMap((group) => [
    `  - group: ${jsonString(group.title)}`,
    '    items:',
    ...group.items.flatMap((item) => [
      `      - id: ${jsonString(item.id)}`,
      `        label: ${jsonString(item.label)}`,
      `        done: ${value[group.id]?.[item.id] ? 'true' : 'false'}`,
    ]),
  ]);
}

function jsonString(value) {
  return JSON.stringify(value);
}

function frontmatter(entry = {}) {
  const prompts = entry.prompts || {};
  const tomorrow = normalizeTomorrow(prompts.tomorrow);
  const metrics = normalizeMetrics(prompts.metrics);
  const todos = normalizeTodos(prompts.todos, tomorrow);
  return [
    '---',
    `date: ${entry.id}`,
    `weekday: ${weekdayForId(entry.id)}`,
    `time: ${jsonString(formatTime(entry.firstRecordedAt))}`,
    `moods: ${jsonString(normalizeMoods(prompts.mood))}`,
    `energy: ${jsonString(prompts.energy || '')}`,
    'metrics:',
    `  weight: ${jsonString(metrics.weight)}`,
    `  sleep: ${jsonString(metrics.sleep)}`,
    `  phone: ${jsonString(metrics.phone)}`,
    'exercises:',
    ...exerciseFrontmatter(prompts.exercises || {}),
    'todos:',
    ...todos.flatMap((todo) => [
      `  - id: ${jsonString(todo.id)}`,
      `    text: ${jsonString(todo.text)}`,
      `    done: ${todo.done ? 'true' : 'false'}`,
    ]),
    'tomorrow:',
    `  done: ${tomorrow.done ? 'true' : 'false'}`,
    `  text: ${jsonString(tomorrow.text)}`,
    '---',
  ].join('\n');
}

export function buildJournalMarkdown(entry = {}) {
  const body = String(entry.body || '').trim();
  const comments = Array.isArray(entry.comments) ? entry.comments.filter((comment) => comment.text) : [];
  const commentsSection = comments.length
    ? [
      '',
      '## 评论',
      '',
      comments.map((comment) => [
        comment.quote ? `> ${comment.quote}` : '',
        comment.text,
      ].filter(Boolean).join('\n\n')).join('\n\n'),
    ].join('\n')
    : '';
  const sideNotes = String(entry.sideNotes || '').trim();
  const sideNotesSection = sideNotes
    ? ['', '## 随便聊几句', '', sideNotes].join('\n')
    : '';
  const retained = entry.retainedConversations || [];
  const savedConversations = retained.length
    ? [
      '',
      '## 已放进这篇日记的对话',
      '',
      retained.map((item) => {
        const lines = (item.messages || [])
          .map((message) => `${message.role === 'user' ? '我' : '回应'}：${message.text || ''}`)
          .join('\n');
        return [`### ${item.title || '一段对话'}`, item.summary || '', lines].filter(Boolean).join('\n\n');
      }).join('\n\n'),
    ].join('\n')
    : '';

  return [
    frontmatter(entry),
    '',
    body,
    commentsSection,
    sideNotesSection,
    savedConversations,
    '',
  ].join('\n');
}

export async function saveJournalEntry(root, entry) {
  const paths = entryPaths(root, entry.id);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.markdownPath, buildJournalMarkdown(entry), 'utf8');
  await writeFile(paths.jsonPath, JSON.stringify(entry, null, 2), 'utf8');
  return paths;
}

export async function saveJournalEntries(root, entries = []) {
  const results = [];
  for (const entry of entries) {
    results.push(await saveJournalEntry(root, entry));
  }
  return results;
}

async function safeReadJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

export async function readJournalEntries(root) {
  if (!existsSync(root)) return [];

  const entries = [];
  const years = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const year of years.filter((item) => item.isDirectory())) {
    const yearPath = join(root, year.name);
    const months = await readdir(yearPath, { withFileTypes: true }).catch(() => []);
    for (const month of months.filter((item) => item.isDirectory())) {
      const monthPath = join(yearPath, month.name);
      const files = await readdir(monthPath, { withFileTypes: true }).catch(() => []);
      for (const file of files.filter((item) => item.isFile() && item.name.endsWith('.json'))) {
        const entry = await safeReadJson(join(monthPath, file.name));
        if (entry?.id) entries.push(entry);
      }
    }
  }

  return entries.sort((a, b) => b.id.localeCompare(a.id));
}

function dateKeyFromIso(value = '') {
  const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function normalizeReviewSummary(raw = {}) {
  const period = raw.period || {};
  const start = dateKeyFromIso(period.start || raw.start || raw.id);
  const end = dateKeyFromIso(period.end || raw.end);
  if (!start) return null;
  const review = raw.review || {};
  const nextActions = [
    review.observationQuestion,
    review.smallAction,
    ...(Array.isArray(review.nextActions) ? review.nextActions : []),
  ].map((item) => String(item || '').trim()).filter(Boolean);

  return {
    id: `week-${start}`,
    type: 'week',
    range: end ? `${start} 至 ${end}` : start,
    entryCount: Number(raw.entryCount || raw.entries?.length || 0),
    summary: String(review.overview || raw.summary || '').trim(),
    patterns: Array.isArray(review.patterns) ? review.patterns.map(String).filter(Boolean) : [],
    blindSpots: Array.isArray(review.blindSpots) ? review.blindSpots.map(String).filter(Boolean) : [],
    recovery: Array.isArray(review.recovery) ? review.recovery.map(String).filter(Boolean) : [],
    strengths: Array.isArray(review.strengths) ? review.strengths.map(String).filter(Boolean) : [],
    nextActions,
    questions: Array.isArray(review.questions) ? review.questions.map(String).filter(Boolean) : [],
    createdAt: raw.generatedAt || raw.createdAt || new Date().toISOString(),
    source: 'review-file',
  };
}

export async function readReviewSummaries(root) {
  if (!existsSync(root)) return [];
  const weeklyRoot = join(root, 'weekly');
  if (!existsSync(weeklyRoot)) return [];

  const files = await readdir(weeklyRoot, { withFileTypes: true }).catch(() => []);
  const summaries = [];
  for (const file of files.filter((item) => item.isFile() && item.name.endsWith('.json'))) {
    const raw = await safeReadJson(join(weeklyRoot, file.name));
    const summary = normalizeReviewSummary(raw || {});
    if (summary?.id) summaries.push(summary);
  }

  return summaries.sort((a, b) => b.id.localeCompare(a.id));
}

export async function deleteJournalEntryFiles(root, id) {
  const paths = entryPaths(root, id);
  const markdownExisted = existsSync(paths.markdownPath);
  const jsonExisted = existsSync(paths.jsonPath);
  await rm(paths.markdownPath, { force: true });
  await rm(paths.jsonPath, { force: true });
  return {
    markdownDeleted: markdownExisted,
    jsonDeleted: jsonExisted,
  };
}
