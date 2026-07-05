import {
  createEntryForDate,
  dateKey,
  deleteEntryById,
  deleteRetainedConversationById,
  dedupeRetainedConversations,
  ensureEntryForDate,
  generateAutomaticSummaries,
  retainedConversationPreview,
  retainConversation,
} from './journal-core.js';

const STORAGE_KEY = 'inner-notes-state-v1';
const app = document.querySelector('#app');
let reminderTimers = [];
let saveTimer;
let savedBodyRange = null;
let cursorToolbarHideTimer = null;

const CURSOR_TOOLBAR_HIDE_DELAY = 650;

const ui = {
  pendingComment: null,
  moodPickerOpen: false,
  mobilePanel: 'main',
};

const moodGroups = [
  { kind: 'steady', label: '安定', items: ['平静', '清醒', '松动', '有希望'] },
  { kind: 'pressure', label: '消耗', items: ['焦虑', '不安', '迷茫', '惶恐', '疲惫'] },
  { kind: 'stuck', label: '卡住', items: ['低产', '拖延', '卡住', '自愧'] },
  { kind: 'relational', label: '边界', items: ['存在感', '边界', '被看见', '风险感'] },
  { kind: 'spark', label: '波动', items: ['激动', '开心', '犹豫'] },
];

const moodKindByName = moodGroups.reduce((result, group) => {
  group.items.forEach((item) => {
    result[item] = group.kind;
  });
  return result;
}, {});

const metricFields = [
  { key: 'weight', label: '体重', unit: 'kg', placeholder: '比如 62.5' },
  { key: 'sleep', label: '睡眠', unit: '小时', placeholder: '比如 7.5' },
  { key: 'phone', label: '手机', unit: '小时', placeholder: '比如 3' },
];

const exerciseGroups = [{
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

const textColors = ['#d84a4a', '#de7a22', '#c99416', '#2f8f52', '#2f65d8', '#7444c7'];
const blockFormats = [
  { action: 'format-block', block: 'p', label: '正文', icon: 'T' },
  { action: 'format-block', block: 'h1', label: 'H1', icon: 'H1' },
  { action: 'format-block', block: 'h2', label: 'H2', icon: 'H2' },
  { action: 'format-block', block: 'h3', label: 'H3', icon: 'H3' },
  { action: 'format-list', list: 'ol', label: '编号列表', icon: '1.' },
  { action: 'format-list', list: 'ul', label: '项目符号', icon: '•' },
  { action: 'format-block', block: 'blockquote', label: '引用', icon: '“' },
];
const dividerPresets = [
  { id: 'line', label: '普通线', icon: '—', pattern: '' },
  { id: 'gem', label: '宝石线', icon: '💎', pattern: '💎 ✦ 💎 ✦ 💎' },
  { id: 'star', label: '星光线', icon: '✨', pattern: '✨ ✦ ✨ ✦ ✨' },
  { id: 'crystal', label: '水晶线', icon: '💠', pattern: '💠 ◇ 💎 ◇ 💠' },
  { id: 'custom', label: '自定义', icon: '⋯', pattern: '💎 ✨ 💎' },
];

const defaultState = {
  entries: [],
  summaries: [],
  user: null,
  selectedEntryId: '',
  selectedReviewId: '',
  view: 'cover',
  archiveFilter: {
    type: 'recent',
    value: '',
  },
  settings: {
    morningReminder: '08:30',
    eveningReminder: '22:00',
    notificationsEnabled: false,
  },
  backup: {
    status: '正在打开日记本...',
    lastAt: '',
    folder: '',
  },
};

let state = normalizeState(loadState());
saveState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return {
      ...defaultState,
      selectedEntryId: saved?.selectedEntryId || '',
      selectedReviewId: saved?.selectedReviewId || '',
      view: ['cover', 'entry', 'review'].includes(saved?.view) ? saved.view : defaultState.view,
      archiveFilter: saved?.archiveFilter || defaultState.archiveFilter,
      settings: { ...defaultState.settings, ...(saved?.settings || {}) },
      backup: { ...defaultState.backup, ...(saved?.backup || {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function normalizePrompts(prompts = {}) {
  const mood = Array.isArray(prompts.mood)
    ? prompts.mood
    : String(prompts.mood || '').split(/[,\s，、#]+/).map((item) => item.trim()).filter(Boolean);
  const tomorrow = prompts.tomorrow && typeof prompts.tomorrow === 'object'
    ? { done: Boolean(prompts.tomorrow.done), text: prompts.tomorrow.text || '' }
    : { done: false, text: prompts.tomorrow || '' };
  const metrics = prompts.metrics && typeof prompts.metrics === 'object' ? prompts.metrics : {};
  const todos = normalizeTodos(prompts.todos, tomorrow);
  const exercises = normalizeExercises(prompts.exercises || {});

  return {
    mood,
    energy: prompts.energy || '',
    metrics: {
      weight: metrics.weight || '',
      sleep: metrics.sleep || '',
      phone: metrics.phone || '',
    },
    todos,
    tomorrow,
    exercises,
  };
}

function normalizeExercises(exercises = {}) {
  return exerciseGroups.reduce((result, group) => {
    const saved = exercises[group.id] && typeof exercises[group.id] === 'object' ? exercises[group.id] : {};
    result[group.id] = group.items.reduce((items, item) => {
      items[item.id] = Boolean(saved[item.id]);
      return items;
    }, {});
    return result;
  }, {});
}

function normalizeTodos(todos, legacyTomorrow = {}) {
  if (Array.isArray(todos)) {
    return todos.map((todo, index) => normalizeTodo(todo, index));
  }
  const legacyText = String(legacyTomorrow.text || '').trim();
  if (!legacyText) return [];
  return legacyText.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => normalizeTodo({
      id: `legacy-tomorrow-${index}`,
      text,
      done: Boolean(legacyTomorrow.done),
    }, index));
}

function normalizeTodo(todo = {}, index = 0) {
  return {
    id: todo.id || `todo-${index}`,
    text: String(todo.text || ''),
    done: Boolean(todo.done),
  };
}

function normalizeComments(comments = []) {
  if (!Array.isArray(comments)) return [];
  return comments.map((comment, index) => ({
    id: comment.id || `comment-${index}`,
    quote: String(comment.quote || comment.anchor || comment.anchorText || ''),
    text: String(comment.text || ''),
    createdAt: comment.createdAt || new Date().toISOString(),
    resolved: Boolean(comment.resolved),
    manual: comment.manual !== false,
  })).filter((comment) => comment.text.trim());
}

function normalizeEntry(entry = {}) {
  const title = !entry.title || entry.title === '今天发生了什么？'
    ? '今天想记下什么？'
    : entry.title;
  return {
    id: entry.id || dateKey(new Date()),
    title,
    firstRecordedAt: entry.firstRecordedAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
    prompts: normalizePrompts(entry.prompts || {}),
    body: entry.body || '',
    bodyHtml: entry.bodyHtml || '',
    readResponse: entry.readResponse || null,
    comments: normalizeComments(entry.comments || []),
    chatMessages: entry.chatMessages || [],
    sideNotes: entry.sideNotes || '',
    retainedConversations: dedupeRetainedConversations(entry.retainedConversations || []),
  };
}

function normalizeState(rawState) {
  const entries = (rawState.entries || []).map(normalizeEntry);
  return {
    ...rawState,
    entries,
    archiveFilter: normalizeArchiveFilter(rawState.archiveFilter),
    summaries: generateAutomaticSummaries(entries, rawState.summaries || []),
  };
}

function normalizeArchiveFilter(filter = {}) {
  const allowed = new Set(['recent', 'all', 'year', 'month', 'week']);
  return {
    type: allowed.has(filter.type) ? filter.type : 'recent',
    value: filter.value || '',
  };
}

function saveState() {
  const { user, ...persistedState } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
}

function refreshAutomaticSummaries() {
  state.summaries = generateAutomaticSummaries(state.entries, state.summaries || []);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderAccountMenu() {
  if (!state.user?.username) return '';
  return `
    <details class="account-menu">
      <summary>${escapeHtml(state.user.username)}</summary>
      <div class="account-menu-panel">
        <button class="text-button" data-action="switch-account">切换账号</button>
        <button class="text-danger-button" data-action="logout">退出</button>
      </div>
    </details>
  `;
}

function sanitizeBodyHtml(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function isEmptyBodyHtml(value = '') {
  return !String(value)
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

const defaultEntryTitles = new Set(['', '今天想记下什么？', '今天发生了什么？']);

function hasCheckedExercise(exercises = {}) {
  return Object.values(exercises || {}).some((group) => (
    group && typeof group === 'object' && Object.values(group).some(Boolean)
  ));
}

function isBlankEntry(entry = {}) {
  const prompts = normalizePrompts(entry.prompts || {});
  const hasPromptText = [
    prompts.energy,
    prompts.metrics.weight,
    prompts.metrics.sleep,
    prompts.metrics.phone,
    prompts.tomorrow.text,
    ...(prompts.mood || []),
    ...(prompts.todos || []).map((todo) => todo.text),
  ].some((value) => String(value || '').trim());
  const hasTodoState = (prompts.todos || []).some((todo) => todo.done && String(todo.text || '').trim());

  return defaultEntryTitles.has(String(entry.title || '').trim())
    && !String(entry.body || '').trim()
    && isEmptyBodyHtml(entry.bodyHtml || '')
    && !hasPromptText
    && !hasTodoState
    && !prompts.tomorrow.done
    && !hasCheckedExercise(prompts.exercises)
    && !String(entry.sideNotes || '').trim()
    && !(entry.readResponse?.response || entry.readResponse?.summary)
    && !(entry.comments || []).length
    && !(entry.chatMessages || []).length
    && !(entry.retainedConversations || []).length;
}

function discardBlankEntry(entryId = '') {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry || !isBlankEntry(entry)) return false;

  const wasSelected = state.selectedEntryId === entry.id;
  state.entries = deleteEntryById(state.entries, entry.id).map(normalizeEntry);
  if (wasSelected) {
    state.selectedEntryId = state.entries[0]?.id || '';
  }
  refreshAutomaticSummaries();
  state.backup = {
    ...state.backup,
    status: '空白页已丢弃',
  };
  saveState();

  fetch(`/api/journal-entry?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE' }).catch(() => {});
  return true;
}

function selectedEntry() {
  return state.entries.find((entry) => entry.id === state.selectedEntryId) || state.entries[0];
}

function selectedReview() {
  return state.summaries.find((summary) => summary.id === state.selectedReviewId) || null;
}

function updateSelectedEntry(updater) {
  const entry = selectedEntry();
  if (!entry) return;
  const updated = normalizeEntry(entry);
  updater(updated);
  updated.updatedAt = new Date().toISOString();
  state.entries = state.entries.map((item) => (item.id === updated.id ? updated : item));
  refreshAutomaticSummaries();
  saveState();
  scheduleJournalSave();
}

function ensureToday() {
  const result = ensureEntryForDate(state.entries, new Date());
  state.entries = result.entries.map(normalizeEntry);
  state.selectedEntryId = state.selectedEntryId || result.entry.id;
  saveState();
  return normalizeEntry(result.entry);
}

function formatTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function weekdayLabel(id) {
  const [year, month, day] = id.split('-').map(Number);
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function dayPart(iso) {
  const hour = new Date(iso || Date.now()).getHours();
  if (hour < 6) return '夜里';
  if (hour < 11) return '早上';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  if (hour < 22) return '晚上';
  return '夜里';
}

function formatDateLine(entry) {
  const [, month, day] = entry.id.split('-').map(Number);
  return `${month} 月 ${day} 日 ${weekdayLabel(entry.id)} · ${dayPart(entry.firstRecordedAt)} ${formatTime(entry.firstRecordedAt)}`;
}

function addDaysToKey(key, amount) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

function entryDayKey(id = '') {
  const match = String(id).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(id).slice(0, 10);
}

function weekStartForDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  return addDaysToKey(key, 1 - weekday);
}

function lastCompletedWeekStartKey(today = dateKey(new Date())) {
  return addDaysToKey(weekStartForDateKey(today), -7);
}

function entrySummary(entry) {
  const body = String(entry.body || '').replace(/\s+/g, ' ').trim();
  if (body) return body.slice(0, 18);
  const moods = entry.prompts?.mood || [];
  if (moods.length) return `${moods.join('、')}，写了一点`;
  return '想到什么写什么';
}

function monthTitle(month = '') {
  const [year, value] = String(month).split('-').map(Number);
  if (!year || !value) return '这本日记';
  return `${year} 年 ${value} 月`;
}

function monthEntries(month = '') {
  return entriesForArchiveFilter()
    .filter((entry) => entry.id.startsWith(month));
}

function averageMetric(entries = [], key = '') {
  const values = entries
    .map((entry) => Number(normalizePrompts(entry.prompts || {}).metrics?.[key]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return '';
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1);
}

function topMood(entries = []) {
  const counts = new Map();
  entries.forEach((entry) => {
    normalizePrompts(entry.prompts || {}).mood.forEach((mood) => {
      counts.set(mood, (counts.get(mood) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function coverMoodStatus(entries = []) {
  const counts = new Map();
  entries.forEach((entry) => {
    normalizePrompts(entry.prompts || {}).mood.forEach((mood) => {
      counts.set(mood, (counts.get(mood) || 0) + 1);
    });
  });
  if (!counts.size) return '还在积累';

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const preferred = ranked.find(([mood]) => ['steady', 'spark', 'relational'].includes(moodKindByName[mood]));
  if (preferred) return `#${preferred[0]}`;

  const top = ranked[0]?.[0] || '';
  const kind = moodKindByName[top];
  if (kind === 'pressure') return '正在调整中';
  if (kind === 'stuck') return '慢慢回来';
  return top ? `#${top}` : '还在积累';
}

function statusMetricText(prompts, key, label, unit = '') {
  const value = prompts.metrics?.[key];
  return value ? `${label} ${value}${unit}` : '';
}

function exerciseTotal(prompts) {
  const exercises = prompts.exercises || normalizeExercises({});
  const totalDone = exerciseGroups.reduce((sum, group) => sum + exerciseProgress(exercises, group).done, 0);
  const totalItems = exerciseGroups.reduce((sum, group) => sum + group.items.length, 0);
  return `${totalDone}/${totalItems}`;
}

function todoSummary(prompts) {
  const todos = (prompts.todos || []).filter((todo) => todo.text.trim());
  const undone = todos.filter((todo) => !todo.done).length;
  return todos.length ? `todo ${undone}/${todos.length}` : '';
}

function unfinishedTodos(limit = 3) {
  return entriesForArchiveFilter()
    .flatMap((entry) => normalizePrompts(entry.prompts || {}).todos
      .filter((todo) => todo.text.trim() && !todo.done)
      .map((todo) => ({ entry, todo })))
    .slice(0, limit);
}

function latestEntry() {
  return entriesForArchiveFilter()[0] || null;
}

function adjacentEntries(entry) {
  const timeline = entriesForArchiveFilter();
  const index = timeline.findIndex((item) => item.id === entry.id);
  if (index < 0) return { previous: null, next: null };

  return {
    previous: index > 0 ? timeline[index - 1] : null,
    next: index < timeline.length - 1 ? timeline[index + 1] : null,
  };
}

function renderEntryPager(entry) {
  const { previous, next } = adjacentEntries(entry);
  if (!previous && !next) return '';

  return `
    <nav class="entry-pager" aria-label="翻看日记">
      ${previous ? `<button class="pager-button previous" data-action="select-entry" data-id="${escapeHtml(previous.id)}">上一篇</button>` : ''}
      ${next ? `<button class="pager-button next" data-action="select-entry" data-id="${escapeHtml(next.id)}">下一篇</button>` : ''}
    </nav>
  `;
}

function todayStatusSummary(prompts) {
  const parts = [
    prompts.mood.length ? prompts.mood.map((mood) => `#${mood}`).join(' ') : '',
    statusMetricText(prompts, 'sleep', '睡眠', 'h'),
    statusMetricText(prompts, 'phone', '手机', 'h'),
    `锻炼 ${exerciseTotal(prompts)}`,
    todoSummary(prompts),
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '写完后顺手留一点状态';
}

function groupedMonths() {
  const months = new Set(state.entries.map((entry) => entry.id.slice(0, 7)));
  return [...months].sort((a, b) => b.localeCompare(a));
}

function archiveFilter() {
  return normalizeArchiveFilter(state.archiveFilter);
}

function entriesForArchiveFilter() {
  return [...state.entries].sort((a, b) => {
    const aTime = new Date(a.firstRecordedAt || a.updatedAt || 0).getTime();
    const bTime = new Date(b.firstRecordedAt || b.updatedAt || 0).getTime();
    return bTime - aTime || b.id.localeCompare(a.id);
  });
}

function archiveHeading() {
  return '全部记录';
}

function archiveButtonClass(type, value = '') {
  const filter = archiveFilter();
  return `archive-link ${filter.type === type && filter.value === value ? 'active' : ''}`;
}

function renderMoodTags(moods = [], size = 'normal') {
  const selected = new Set(moods);
  if (size === 'mini') {
    return moods.map((mood) => `
      <span class="mini-tag ${escapeHtml(moodKindByName[mood] || 'custom')}">#${escapeHtml(mood)}</span>
    `).join('');
  }

  const known = new Set(moodGroups.flatMap((group) => group.items));
  const customMoods = moods.filter((mood) => !known.has(mood));
  const groups = customMoods.length
    ? [...moodGroups, { kind: 'custom', label: '自定义', items: customMoods }]
    : moodGroups;

  return groups.map((group) => `
    <div class="mood-group ${escapeHtml(group.kind)}">
      <div class="mood-group-label">${escapeHtml(group.label)}</div>
      <div class="mood-group-chips">
        ${group.items.map((mood) => {
          const active = selected.has(mood);
          return `<button class="chip ${escapeHtml(group.kind)} ${active ? 'active' : ''}" data-action="toggle-mood" data-mood="${escapeHtml(mood)}">#${escapeHtml(mood)}</button>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

function renderArchive() {
  const today = dateKey(new Date());
  const visibleEntries = entriesForArchiveFilter();
  return `
    <div class="side-label" data-archive-heading>${archiveHeading()}</div>
    <div class="day-list">
      ${visibleEntries.length ? visibleEntries.map((entry) => `
        <div class="day-row ${!state.selectedReviewId && state.selectedEntryId === entry.id ? 'active' : ''}">
          <button class="day-card" data-action="select-entry" data-id="${escapeHtml(entry.id)}">
            <div class="day-title">
              <span>${escapeHtml(formatShortDate(entry.id))} ${escapeHtml(weekdayLabel(entry.id))}</span>
              <time>${escapeHtml(formatTime(entry.firstRecordedAt))}</time>
            </div>
            <small>${escapeHtml(entryDayKey(entry.id) === today && !entry.body ? '今天，先写一点' : entrySummary(entry))}</small>
            <div class="day-tags">${renderMoodTags(entry.prompts?.mood || [], 'mini')}</div>
          </button>
          <div class="day-actions">
            <details class="entry-menu">
              <summary data-action="toggle-entry-menu" data-id="${escapeHtml(entry.id)}" aria-label="日记操作">...</summary>
              <button data-action="delete-entry" data-id="${escapeHtml(entry.id)}">删除</button>
            </details>
          </div>
        </div>
      `).join('') : '<p class="quiet-copy">这里还没有记录。</p>'}
    </div>

    <div class="side-label">自动回顾</div>
    <div class="review-list">
      ${renderReviewLinks()}
    </div>
  `;
}

function renderCalendarHeatmap() {
  const entriesByDay = state.entries.reduce((result, entry) => {
    const key = entryDayKey(entry.id);
    if (!key) return result;
    result[key] = entry;
    return result;
  }, {});
  const today = dateKey(new Date());
  const days = Array.from({ length: 35 }, (_, index) => addDaysToKey(today, index - 34));

  return `
    <div class="calendar-heatmap" aria-label="最近 35 天记录日历">
      ${['一', '二', '三', '四', '五', '六', '日'].map((day) => `<span class="heat-weekday">${day}</span>`).join('')}
      ${days.map((day) => {
        const entry = entriesByDay[day];
        const bodyLength = String(entry?.body || '').trim().length;
        const level = entry ? Math.min(4, Math.max(1, Math.ceil(bodyLength / 28))) : 0;
        const label = entry ? `${formatShortDate(day)} ${entrySummary(entry)}` : `${formatShortDate(day)} 没有记录`;
        return entry
          ? `<button class="heat-day level-${level}" data-action="select-entry" data-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"></button>`
          : `<span class="heat-day level-0" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"></span>`;
      }).join('')}
    </div>
  `;
}

function renderCoverMonthNav() {
  const months = groupedMonths();
  if (!months.length) {
    return '<p class="quiet-copy">还没有记录。先写今天这一页。</p>';
  }
  return months.map((month) => `
    <button class="month-nav-item" data-action="open-month" data-month="${escapeHtml(month)}">
      <span>${escapeHtml(monthTitle(month))}</span>
      <em>${escapeHtml(monthEntries(month).length)} 篇</em>
    </button>
  `).join('');
}

function renderTagNav() {
  const counts = new Map();
  state.entries.forEach((entry) => {
    normalizePrompts(entry.prompts || {}).mood.forEach((mood) => {
      counts.set(mood, (counts.get(mood) || 0) + 1);
    });
  });
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!tags.length) return '<p class="quiet-copy">标签会从你的状态里长出来。</p>';
  return `
    <div class="tag-nav">
      ${tags.map(([tag, count]) => `<span class="tag-pill ${escapeHtml(moodKindByName[tag] || 'custom')}">#${escapeHtml(tag)} <em>${count}</em></span>`).join('')}
    </div>
  `;
}

function renderCoverSidebar() {
  return `
    <aside class="cover-sidebar">
      <div class="brand" aria-label="Inner Notes">
        <div class="brand-mark"></div>
        <div>Inner Notes</div>
      </div>

      <div class="side-label">记录日历</div>
      ${renderCalendarHeatmap()}

      <div class="side-label">按月回看</div>
      <div class="month-nav">${renderCoverMonthNav()}</div>

      <div class="side-label">标签</div>
      ${renderTagNav()}

      <div class="side-label">最近回顾</div>
      <div class="review-list">${renderReviewLinks()}</div>
    </aside>
  `;
}

function sameMonthDay(entry, monthDay) {
  return entryDayKey(entry.id).slice(5) === monthDay;
}

function renderMemoryCards() {
  const today = dateKey(new Date());
  const monthDay = today.slice(5);
  const memories = entriesForArchiveFilter()
    .filter((entry) => sameMonthDay(entry, monthDay) && entryDayKey(entry.id) !== today)
    .slice(0, 2);
  const fallback = entriesForArchiveFilter().filter((entry) => entryDayKey(entry.id) !== today).slice(0, 2);
  const items = memories.length ? memories : fallback;
  if (!items.length) {
    return '<p class="quiet-copy">多写几天，这里会出现可以回看的片段。</p>';
  }

  return items.map((entry) => `
    <button class="memory-card" data-action="select-entry" data-id="${escapeHtml(entry.id)}">
      <span>${escapeHtml(memories.length ? '过去的今天' : '最近回看')}</span>
      <strong>${escapeHtml(formatShortDate(entry.id))} ${escapeHtml(weekdayLabel(entry.id))}</strong>
      <p>${escapeHtml(entrySummary(entry))}</p>
    </button>
  `).join('');
}

function renderMonthRevisitCards() {
  const months = groupedMonths();
  if (!months.length) {
    return '<p class="quiet-copy">还没有月份可以回看。先记录今天，这里会慢慢长出来。</p>';
  }
  return months.map((month) => {
    const entries = monthEntries(month);
    const mood = coverMoodStatus(entries);
    const sleep = averageMetric(entries, 'sleep');
    const phone = averageMetric(entries, 'phone');
    const colorClass = `month-${Number(month.slice(5, 7)) % 5}`;
    const stats = [
      mood ? `<span>${escapeHtml(mood)}</span>` : '',
      sleep ? `<span>睡眠 ${escapeHtml(sleep)}h</span>` : '',
      phone ? `<span>手机 ${escapeHtml(phone)}h</span>` : '',
    ].filter(Boolean).join('');
    return `
      <article class="month-revisit">
        <button class="month-revisit-card memory-card ${colorClass}" data-action="open-month" data-month="${escapeHtml(month)}" aria-label="打开 ${escapeHtml(monthTitle(month))}">
          <span>按月回看</span>
          <strong>${escapeHtml(monthTitle(month))}</strong>
          <p>${escapeHtml(entries.length)} 篇记录${mood ? ` · ${mood}` : ''}</p>
          <div class="book-stats">${stats}</div>
        </button>
        <div class="page-strip" aria-label="${escapeHtml(monthTitle(month))}的日记页">
          ${entries.slice(0, 4).map((entry) => `
            <button class="page-card memory-card soft-memory" data-action="select-entry" data-id="${escapeHtml(entry.id)}">
              <span>${escapeHtml(formatShortDate(entry.id))} ${escapeHtml(weekdayLabel(entry.id))}</span>
              <time>${escapeHtml(formatTime(entry.firstRecordedAt))}</time>
              <p>${escapeHtml(entrySummary(entry))}</p>
            </button>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderCoverPage() {
  const lastReview = reviewSummariesForSidebar()[0];
  const todos = unfinishedTodos(3);
  return `
    <section class="cover-page">
      <div class="cover-kicker">Inner Notes</div>
      <h1>今天想记下什么？</h1>
      <p class="cover-intro">先写今天，也可以从日历、月份和回顾里翻回某一段时间。</p>
      <div class="cover-actions">
        <button class="primary-button cover-primary" data-action="start-today" aria-label="记录今天">写今天这一页</button>
      </div>
      <section class="cover-section">
        <div class="section-head">
          <strong>过去的今天</strong>
          <span>把旧的一页重新点亮</span>
        </div>
        <div class="memory-grid">
          ${renderMemoryCards()}
        </div>
      </section>
      <section class="cover-desk">
        ${lastReview ? `
          <button class="cover-note review-note memory-card" data-action="select-review" data-id="${escapeHtml(lastReview.id)}">
            <span>上周回顾</span>
            <strong>${escapeHtml(reviewLabel(lastReview))}</strong>
          </button>
        ` : ''}
        <div class="cover-note">
          <span>未完成 todo</span>
          ${todos.length ? todos.map(({ todo }) => `<strong>${escapeHtml(todo.text)}</strong>`).join('') : '<strong>没有未完成事项</strong>'}
        </div>
      </section>
      <section class="analysis-strip">
        <div>
          <strong>本月</strong>
          <span>看睡眠、状态和记录节奏的慢变化。</span>
        </div>
        <div class="analysis-cards">
          <article><strong>睡眠趋势</strong><p>${escapeHtml(averageMetric(state.entries, 'sleep') || '再多写几天')}</p></article>
          <article><strong>最近状态</strong><p>${escapeHtml(coverMoodStatus(state.entries))}</p></article>
          <article><strong>记录时间</strong><p>${escapeHtml(state.entries[0] ? formatTime(state.entries[0].firstRecordedAt) : '还没有')}</p></article>
        </div>
      </section>
      <section class="cover-section">
        <div class="section-head">
          <strong>按月回看</strong>
          <span>每个月像一册生活切片</span>
        </div>
        <div class="month-revisit-list">
          ${renderMonthRevisitCards()}
        </div>
      </section>
    </section>
  `;
}

function renderCoverSide() {
  const lastReview = reviewSummariesForSidebar()[0];
  return `
    <section class="side-block">
      <div class="side-head"><strong>日记本封面</strong></div>
      <p class="muted-copy">选一本翻回去，或者从今天开始写。</p>
      ${lastReview ? `
        <button class="review-teaser" data-action="select-review" data-id="${escapeHtml(lastReview.id)}">
          <span>最近回顾</span>
          <strong>${escapeHtml(reviewLabel(lastReview))}</strong>
        </button>
      ` : '<p class="muted-copy">上周多写几天，就能看见一点脉络。</p>'}
    </section>
  `;
}

function renderReviewLinks() {
  const visibleSummaries = reviewSummariesForSidebar();
  if (!visibleSummaries.length) {
    return '<p class="quiet-copy">上周多写几天，就能看见一点脉络。</p>';
  }
  return visibleSummaries.map((summary) => `
    <button class="review-link ${summary.type === 'month' ? 'month' : 'week'} ${state.selectedReviewId === summary.id ? 'active' : ''}" data-action="select-review" data-id="${escapeHtml(summary.id)}">${escapeHtml(reviewLabel(summary))}</button>
  `).join('');
}

function reviewSummariesForSidebar() {
  const lastWeekId = `week-${lastCompletedWeekStartKey()}`;
  return state.summaries.filter((summary) => summary.type === 'week' && summary.id === lastWeekId).slice(0, 1);
}

function reviewRangeLabel(start = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '';
  return `${formatShortDate(start)} - ${formatShortDate(addDaysToKey(start, 6))}`;
}

function reviewLabel(summary = {}) {
  const today = dateKey(new Date());
  if (summary.type === 'month') {
    const currentMonth = today.slice(0, 7);
    if (summary.month === currentMonth) return '这个月的回顾';
    const [year, month] = String(summary.month || '').split('-').map(Number);
    if (!year || !month) return '这个月的回顾';
    return year === Number(today.slice(0, 4)) ? `${month} 月的回顾` : `${year} 年 ${month} 月的回顾`;
  }

  const start = String(summary.id || '').replace(/^week-/, '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return '这一周的回顾';
  if (start === lastCompletedWeekStartKey(today)) return `上周回顾 · ${reviewRangeLabel(start)}`;
  if (start === weekStartForDateKey(today)) return `这一周 · ${reviewRangeLabel(start)}`;
  return reviewRangeLabel(start);
}

function formatShortDate(id) {
  const [, month, day] = id.split('-').map(Number);
  return `${month} 月 ${day} 日`;
}

function renderBodyEditor(entry) {
  const bodyHtml = sanitizeBodyHtml(entry.bodyHtml || '');
  const body = entry.body?.trim();
  const isEmpty = !body && isEmptyBodyHtml(bodyHtml);
  const content = isEmpty ? '' : bodyHtml || escapeHtml(body).replaceAll('\n', '<br>');
  return `
    <div class="body-shell ${isEmpty ? 'is-empty' : ''}">
      ${renderInsertToolbar()}
      ${renderBlockToolbar()}
      <div class="body-input body-editor" contenteditable="true" data-field="body" data-placeholder="想到什么写什么，不用完整。">${content}</div>
    </div>
  `;
}

function renderInsertToolbar() {
  return `
    <details class="insert-toolbar" data-insert-toolbar>
      <summary aria-label="插入内容" title="插入内容">+</summary>
      <div class="insert-menu">
        <div class="insert-section-title">基础</div>
        <div class="insert-grid">
          <button type="button" data-action="insert-callout" data-emoji="🥛"><strong>▰</strong><span>高亮块</span></button>
        </div>
        <div class="insert-section-title">分割线</div>
        <div class="divider-grid">
          ${dividerPresets.map((item) => `
            <button type="button" data-action="insert-divider" data-divider="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.icon)}</strong>
              <span>${escapeHtml(item.label)}</span>
            </button>
          `).join('')}
        </div>
        <label class="custom-divider">
          <span>自定义 emoji</span>
          <input data-custom-divider value="💎 ✨ 💎" aria-label="自定义 emoji 分割线">
        </label>
      </div>
    </details>
  `;
}

function renderBlockToolbar() {
  return `
    <details class="block-toolbar" data-block-toolbar>
      <summary aria-label="段落类型" title="段落类型"><span>T</span></summary>
      <div class="block-menu">
        ${blockFormats.map((item) => `
          <button
            type="button"
            class="block-choice"
            data-action="${escapeHtml(item.action)}"
            ${item.block ? `data-block="${escapeHtml(item.block)}"` : ''}
            ${item.list ? `data-list="${escapeHtml(item.list)}"` : ''}
            aria-label="${escapeHtml(item.label)}"
            title="${escapeHtml(item.label)}"
          >
            <strong>${escapeHtml(item.icon)}</strong>
            <span>${escapeHtml(item.label)}</span>
          </button>
        `).join('')}
      </div>
    </details>
  `;
}

function renderSelectionToolbar() {
  return `
    <div class="selection-toolbar" data-selection-toolbar hidden>
      <button type="button" data-action="format-bold" aria-label="加粗"><strong>B</strong></button>
      <button type="button" data-action="format-italic" aria-label="斜体"><em>I</em></button>
      <button type="button" data-action="format-highlight" aria-label="高亮"><span>A</span></button>
      <span class="toolbar-group color-tools" aria-label="字体颜色">
        ${textColors.map((color) => `
          <button type="button" class="color-button" data-action="format-color" data-color="${escapeHtml(color)}" aria-label="文字颜色">
            <span class="color-dot" style="background:${escapeHtml(color)}"></span>
          </button>
        `).join('')}
      </span>
      <button type="button" data-action="start-comment" aria-label="评论">评论</button>
    </div>
  `;
}

function renderReadResponse(entry) {
  const response = entry.readResponse;
  if (!entry.body?.trim()) {
    return '<p class="quiet-copy">写完后，我可以陪你看一遍。</p>';
  }
  if (!response?.response) {
    return '<p class="quiet-copy">写完后，我可以陪你看一遍。</p>';
  }
  return `
    <article class="read-card">
      <span class="read-label">读后回应</span>
      ${response.quote ? `<blockquote>${escapeHtml(response.quote)}</blockquote>` : ''}
      <p>${escapeHtml(response.response)}</p>
      ${response.question ? `<div class="read-question">${escapeHtml(response.question)}</div>` : ''}
      ${response.details?.length ? `
        <details class="fine-read">
          <summary>再细看一点</summary>
          <ul>${response.details.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </details>
      ` : ''}
    </article>
  `;
}

function renderMessages(entry) {
  const messages = entry.chatMessages || [];
  if (!messages.length) return '';
  return messages.map((message) => `
    <div class="bubble ${escapeHtml(message.role === 'user' ? 'user' : 'me')}">${renderMessageContent(message)}</div>
  `).join('');
}

function renderMessageContent(message) {
  if (message.role !== 'assistant' || !message.sections) return escapeHtml(message.text || '');
  return `
    <div class="assistant-reply">
      <p>${escapeHtml(message.sections.reaction)}</p>
      <p>${escapeHtml(message.sections.thinking)}</p>
      <p>${escapeHtml(message.sections.conclusion)}</p>
    </div>
  `;
}

function renderRetained(entry) {
  const retained = entry.retainedConversations || [];
  if (!retained.length) return '';
  return `
    <details class="saved-chat">
      <summary>已放进这篇日记 <span>${escapeHtml(retained.length)} 段对话</span></summary>
      ${retained.map((item) => {
        const preview = retainedConversationPreview(item, 2);
        return `
          <div class="saved-chat-item">
            <strong>${escapeHtml(preview.title)}</strong>
            <p>${escapeHtml(preview.summary)}</p>
            ${preview.lines.map((line) => `<p><span>${escapeHtml(line.speaker)}：</span>${escapeHtml(line.text)}</p>`).join('')}
            <button class="text-button" data-action="delete-retained" data-id="${escapeHtml(item.id || '')}">移出这篇</button>
          </div>
        `;
      }).join('')}
    </details>
  `;
}

function activeComments(entry) {
  return normalizeComments(entry.comments || []).filter((comment) => !comment.resolved);
}

function renderPendingComment() {
  if (!ui.pendingComment) return '';
  return `
    <article class="comment-card pending">
      <blockquote>${escapeHtml(ui.pendingComment.quote)}</blockquote>
      <textarea class="comment-input" data-comment-input placeholder="输入评论"></textarea>
      <div class="comment-actions">
        <span>Enter 完成，Shift + Enter 换行</span>
        <button class="text-button" data-action="cancel-comment">取消</button>
      </div>
    </article>
  `;
}

function renderManualComments(entry) {
  const comments = activeComments(entry);
  return `
    <section class="comment-panel ${comments.length || ui.pendingComment ? '' : 'is-empty'}">
      <div class="panel-title">评论 <span>${escapeHtml(comments.length)} 条</span></div>
      ${renderPendingComment()}
      ${comments.length ? comments.map((comment) => `
        <article class="comment-card" data-comment-id="${escapeHtml(comment.id)}">
          ${comment.quote ? `<blockquote>${escapeHtml(comment.quote)}</blockquote>` : ''}
          <div class="comment-body">
            <p>${escapeHtml(comment.text)}</p>
            <button class="resolve-button" data-action="resolve-comment" data-id="${escapeHtml(comment.id)}">解决</button>
          </div>
        </article>
      `).join('') : '<p class="quiet-copy comment-empty-copy">选中一句，留下一点旁注。</p>'}
    </section>
  `;
}

function renderSideNotes(entry) {
  return `
    <section class="side-notes">
      <div class="panel-title">随便聊几句</div>
      <textarea class="side-notes-input" data-side-notes placeholder="旧日记里的想法，写这里。">${escapeHtml(entry.sideNotes || '')}</textarea>
    </section>
  `;
}

function renderMetricInputs(metrics = {}) {
  return metricFields.map((field) => `
    <label class="metric-input">
      <span>${escapeHtml(field.label)}</span>
      <input
        data-metric="${escapeHtml(field.key)}"
        inputmode="decimal"
        value="${escapeHtml(metrics[field.key] || '')}"
        placeholder="${escapeHtml(field.placeholder)}"
        aria-label="${escapeHtml(field.label)}"
      >
      <em>${escapeHtml(field.unit)}</em>
    </label>
  `).join('');
}

function renderMoodStatus(prompts) {
  const chosen = prompts.mood.length
    ? prompts.mood.map((mood) => `<span class="${escapeHtml(moodKindByName[mood] || 'custom')}">#${escapeHtml(mood)}</span>`).join('')
    : '<em>还没选</em>';
  return `
    <div class="mood-status-line">
      <div>
        <strong>情绪</strong>
        <p>${chosen}</p>
      </div>
      <button class="text-button" data-action="toggle-mood-picker">${ui.moodPickerOpen ? '收起' : '选择'}</button>
    </div>
    ${ui.moodPickerOpen ? `
      <div class="mood-picker">
        ${renderMoodTags(prompts.mood)}
      </div>
    ` : ''}
  `;
}

function renderTodayStatus(entry, prompts) {
  return `
    <section class="settle status-card">
      <div class="settle-title">今天留一点状态</div>
      <div class="status-summary">${escapeHtml(todayStatusSummary(prompts))}</div>
      <div class="status-block">
        <div class="status-block-title">身体</div>
        <div class="metrics-row">
          ${renderMetricInputs(prompts.metrics)}
        </div>
      </div>
      <div class="status-block">
        ${renderMoodStatus(prompts)}
      </div>
      <div class="status-block action-block">
        ${renderExercises(prompts)}
        ${renderTodos(entry, prompts)}
      </div>
    </section>
  `;
}

function exerciseProgress(exercises = {}, group) {
  const done = group.items.filter((item) => exercises[group.id]?.[item.id]).length;
  return { done, total: group.items.length };
}

function renderExercises(prompts) {
  const exercises = prompts.exercises || normalizeExercises({});
  const totalDone = exerciseGroups.reduce((sum, group) => sum + exerciseProgress(exercises, group).done, 0);
  const totalItems = exerciseGroups.reduce((sum, group) => sum + group.items.length, 0);

  return `
    <details class="exercise-details">
      <summary>
        <span>每日锻炼</span>
        <em>${escapeHtml(`${totalDone}/${totalItems}`)}</em>
      </summary>
      ${exerciseGroups.map((group) => {
        const progress = exerciseProgress(exercises, group);
        return `
          <div class="exercise-card">
            <div class="exercise-head">
              <strong>${escapeHtml(group.title)}</strong>
              <span>${escapeHtml(`${progress.done}/${progress.total}`)}</span>
            </div>
            <div class="exercise-list">
              ${group.items.map((item) => {
                const done = Boolean(exercises[group.id]?.[item.id]);
                return `
                  <button class="exercise-item ${done ? 'done' : ''}" data-action="toggle-exercise" data-exercise-group="${escapeHtml(group.id)}" data-exercise-id="${escapeHtml(item.id)}">
                    <span class="todo-check ${done ? 'checked' : ''}"></span>
                    <span>${escapeHtml(item.label)}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </details>
  `;
}

function makeTodoId() {
  return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function renderTodoItem(entryId, todo, options = {}) {
  const done = Boolean(todo.done);
  if (options.readonly) {
    return `
      <div class="todo-item carry ${done ? 'done' : ''}">
        <button class="todo-check ${done ? 'checked' : ''}" data-action="toggle-todo" data-entry-id="${escapeHtml(entryId)}" data-todo-id="${escapeHtml(todo.id)}" aria-label="标记完成"></button>
        <label class="todo-carry-text">
          <em>${escapeHtml(formatShortDate(entryId))}</em>
          <input
            class="todo-text"
            data-todo-input
            data-todo-text="${escapeHtml(todo.id)}"
            data-entry-id="${escapeHtml(entryId)}"
            value="${escapeHtml(todo.text)}"
            placeholder="补上一件未完成的事"
          >
        </label>
      </div>
    `;
  }
  return `
    <div class="todo-item ${done ? 'done' : ''}">
      <button class="todo-check ${done ? 'checked' : ''}" data-action="toggle-todo" data-entry-id="${escapeHtml(entryId)}" data-todo-id="${escapeHtml(todo.id)}" aria-label="标记完成"></button>
      <input
        class="todo-text"
        data-todo-input
        data-todo-text="${escapeHtml(todo.id)}"
        data-entry-id="${escapeHtml(entryId)}"
        value="${escapeHtml(todo.text)}"
        placeholder="添加一件今天要做的事"
      >
    </div>
  `;
}

function currentTodosForRender(prompts) {
  return prompts.todos.length
    ? prompts.todos
    : [{ id: 'new-todo', text: '', done: false, draft: true }];
}

function unfinishedMonthlyTodos(entry) {
  const month = entry.id.slice(0, 7);
  return state.entries
    .filter((item) => item.id.slice(0, 7) === month && item.id < entry.id)
    .flatMap((item) => {
      const prompts = normalizePrompts(item.prompts || {});
      return prompts.todos
        .filter((todo) => todo.text.trim() && !todo.done)
        .map((todo) => ({ entryId: item.id, todo }));
    });
}

function renderTodos(entry, prompts) {
  const carried = unfinishedMonthlyTodos(entry);
  return `
    <div class="todo-section">
      <div class="todo-group-title">今天的 todo</div>
      <div class="todo-list">
        ${currentTodosForRender(prompts).map((todo) => renderTodoItem(entry.id, todo)).join('')}
      </div>
      ${carried.length ? `
        <div class="todo-group-title muted">本月未完成</div>
        <div class="todo-list carried">
          ${carried.map((item) => renderTodoItem(item.entryId, item.todo, { readonly: true })).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

function renderSummaryItems(title, items = []) {
  const values = (Array.isArray(items) ? items : []).filter(Boolean);
  if (!values.length) return '';
  return `
    <section class="review-section">
      <h2>${escapeHtml(title)}</h2>
      <ul>
        ${values.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `;
}

function renderReviewPaper(summary) {
  const label = reviewLabel(summary);
  const start = String(summary.id || '').replace(/^week-/, '');
  const range = summary.type === 'week' ? reviewRangeLabel(start) : summary.month;
  return `
    <section class="paper review-paper">
      <div class="date-line">${escapeHtml(range || '自动回顾')}</div>
      <h1 class="review-title">${escapeHtml(label)}</h1>
      <p class="review-summary">${escapeHtml(summary.summary || '这段时间已经留下了一些记录。')}</p>
      ${summary.type === 'month' ? `
        ${renderSummaryItems('主题', summary.themes || [])}
      ` : `
        ${renderSummaryItems('重复出现的模式', summary.patterns || [])}
        ${renderSummaryItems('可能没看见的地方', summary.blindSpots || [])}
        ${renderSummaryItems('恢复方式', summary.recovery || [])}
        ${renderSummaryItems('隐藏优点', summary.strengths || [])}
        ${renderSummaryItems('下周小动作', summary.nextActions || [])}
        ${renderSummaryItems('可以问自己的问题', summary.questions || [])}
      `}
    </section>
  `;
}

function renderEntryMain(entry, prompts) {
  return `
    <section class="paper">
      <div class="date-line">${escapeHtml(formatDateLine(entry))}</div>
      <input class="title-input" data-field="title" value="${escapeHtml(entry.title || '今天想记下什么？')}" aria-label="日记标题">

      ${renderBodyEditor(entry)}

      <div class="soft-actions">
        <div class="entry-actions-left">
          <button class="button" data-action="save-entry">保存</button>
          <button class="button danger" data-action="delete-entry" data-id="${escapeHtml(entry.id)}">删除</button>
        </div>
        <span class="save-state" data-save-status>${escapeHtml(state.backup.status)}</span>
        ${renderEntryPager(entry)}
      </div>
      ${renderSelectionToolbar()}
    </section>

    ${renderTodayStatus(entry, prompts)}
  `;
}

function renderReviewSide(summary) {
  return `
    <section class="side-block">
      <div class="side-head">
        <strong>回顾</strong>
      </div>
      <p class="muted-copy">这是根据这段时间的本地日记自动整理的。</p>
      <p class="muted-copy">${escapeHtml(summary.entryCount || 0)} 篇记录</p>
    </section>
  `;
}

function markSummary(prompts) {
  const parts = [];
  if (prompts.mood.length) parts.push(prompts.mood.map((mood) => `#${mood}`).join(' '));
  return parts.length ? parts.join(' · ') : '点开选择';
}

function textareaRows(text = '') {
  return Math.min(6, Math.max(1, String(text).split('\n').length));
}

function render() {
  const showCover = state.view === 'cover';
  const review = state.view === 'review' ? selectedReview() : null;
  const entry = showCover ? null : (selectedEntry() || ensureToday());
  const prompts = normalizePrompts(entry?.prompts || {});
  const mobilePanel = ['menu', 'main', 'notes'].includes(ui.mobilePanel) ? ui.mobilePanel : 'main';

  if (showCover) {
    app.innerHTML = `
      <div class="journal cover-mode">
        ${renderAccountMenu()}
        ${renderCoverSidebar()}
        <main class="main cover-main">
          ${renderCoverPage()}
        </main>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="journal mobile-show-${escapeHtml(mobilePanel)}">
      ${renderAccountMenu()}
      <nav class="mobile-switcher" aria-label="移动端视图切换">
        <button class="${mobilePanel === 'menu' ? 'active' : ''}" data-action="toggle-mobile-panel" data-panel="menu">目录</button>
        <button class="${mobilePanel === 'main' ? 'active' : ''}" data-action="toggle-mobile-panel" data-panel="main">正文</button>
        <button class="${mobilePanel === 'notes' ? 'active' : ''}" data-action="toggle-mobile-panel" data-panel="notes">旁注</button>
      </nav>
      <aside class="sidebar">
        <div class="brand" aria-label="Inner Notes">
          <div class="brand-mark"></div>
          <div>Inner Notes</div>
        </div>

        <button class="button sidebar-cover-link" data-action="open-cover">回到日记本</button>

        <button class="primary-button" data-action="start-today">写今天这一页</button>

        ${renderArchive()}

        <details class="side-details">
          <summary>查看更多</summary>
          <p>保存位置：${escapeHtml(state.backup.folder || '正在连接本地文件夹...')}</p>
          <button class="text-button" data-action="backup-now">立即备份</button>
          <label>早上提醒
            <input type="time" data-setting="morningReminder" value="${escapeHtml(state.settings.morningReminder)}">
          </label>
          <label>晚上记录
            <input type="time" data-setting="eveningReminder" value="${escapeHtml(state.settings.eveningReminder)}">
          </label>
          <button class="text-button" data-action="enable-notifications">开启提醒</button>
        </details>
      </aside>

      <main class="main">
        ${review ? renderReviewPaper(review) : renderEntryMain(entry, prompts)}
      </main>

      <aside class="right-panel">
        ${review ? renderReviewSide(review) : `${renderManualComments(entry)}${renderSideNotes(entry)}`}
      </aside>
    </div>
  `;
}

function getWeekNumber(date) {
  const first = new Date(Date.UTC(date.getFullYear(), 0, 1));
  const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  return Math.ceil((((current - first) / 86400000) + first.getUTCDay() + 1) / 7);
}

function resizeTextarea(input) {
  if (!input?.style) return;
  input.style.height = 'auto';
  input.style.height = `${input.scrollHeight}px`;
}

function handleInput(event) {
  const field = event.target.dataset.field;
  const setting = event.target.dataset.setting;
  const tomorrow = event.target.dataset.tomorrow;
  const metric = event.target.dataset.metric;
  const todoText = event.target.dataset.todoText;
  const entryId = event.target.dataset.entryId;
  const sideNotes = Object.prototype.hasOwnProperty.call(event.target.dataset, 'sideNotes');

  if (field) {
    updateSelectedEntry((entry) => {
      if (field === 'body') {
        entry.body = (event.target.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
        entry.bodyHtml = sanitizeBodyHtml(event.target.innerHTML || '');
      } else {
        entry[field] = 'value' in event.target
          ? event.target.value
          : (event.target.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      }
    });
  }

  if (tomorrow) {
    resizeTextarea(event.target);
    updateSelectedEntry((entry) => {
      entry.prompts = normalizePrompts(entry.prompts);
      entry.prompts.tomorrow.text = event.target.value;
    });
  }

  if (metric) {
    updateSelectedEntry((entry) => {
      entry.prompts = normalizePrompts(entry.prompts);
      entry.prompts.metrics[metric] = event.target.value;
    });
  }

  if (todoText) {
    updateTodoText(entryId, todoText, event.target.value);
  }

  if (sideNotes) {
    updateSelectedEntry((entry) => {
      entry.sideNotes = event.target.value;
    });
  }

  if (setting) {
    state.settings[setting] = event.target.value;
    saveState();
    scheduleReminders();
  }
}

function setSaveStatus(text) {
  state.backup.status = text;
  saveState();
  document.querySelectorAll('[data-save-status]').forEach((item) => {
    item.textContent = text;
  });
}

async function loadCurrentUser() {
  const response = await fetch('/api/me');
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.assign('/login.html');
    return false;
  }
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `Session failed: ${response.status}`);
  state.user = payload.user || null;
  return true;
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    localStorage.removeItem(STORAGE_KEY);
    window.location.assign('/login.html');
  }
}

function isEditingElement(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tagName = String(element.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) return true;
  return Boolean(element.closest?.('[contenteditable="true"], input, textarea, select'));
}

function shouldRenderAfterSave(manual) {
  if (manual) return true;
  return !isEditingElement(document.activeElement);
}

function scheduleJournalSave() {
  window.clearTimeout(saveTimer);
  setSaveStatus('正在保存...');
  saveTimer = window.setTimeout(() => {
    saveCurrentEntry(false);
  }, 800);
}

async function saveCurrentEntry(manual = true) {
  const entry = selectedEntry();
  if (!entry) return;
  if (isBlankEntry(entry)) {
    discardBlankEntry(entry.id);
    if (!state.entries.length) state.view = 'cover';
    saveState();
    if (shouldRenderAfterSave(manual)) {
      render();
    } else {
      setSaveStatus('空白页已丢弃');
    }
    return;
  }
  try {
    const response = await fetch('/api/journal-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Save failed: ${response.status}`);
    state.backup = {
      ...state.backup,
      status: manual ? '刚刚保存' : '本地文件已更新',
      lastAt: new Date().toISOString(),
      folder: payload.folder || state.backup.folder,
    };
  } catch (error) {
    state.backup = {
      ...state.backup,
      status: `保存失败：${error.message}`,
    };
  }
  saveState();
  if (shouldRenderAfterSave(manual)) {
    render();
  } else {
    setSaveStatus(state.backup.status);
  }
}

async function saveAllEntries() {
  try {
    const response = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: state.entries }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Save failed: ${response.status}`);
    state.backup.folder = payload.folder || state.backup.folder;
    state.backup.status = '本地文件已更新';
    state.backup.lastAt = new Date().toISOString();
  } catch (error) {
    state.backup.status = `保存失败：${error.message}`;
  }
  saveState();
}

async function backupNow(shouldRender = true) {
  try {
    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries: state.entries,
        summaries: state.summaries,
      }),
    });
    if (!response.ok) throw new Error(`Backup failed: ${response.status}`);
    const payload = await response.json();
    state.backup = {
      ...state.backup,
      status: '已备份到桌面',
      lastAt: new Date().toISOString(),
      backupFolder: payload.folder || '',
    };
  } catch {
    state.backup = {
      ...state.backup,
      status: '备份服务未连接',
    };
  }
  saveState();
  if (shouldRender) render();
}

async function requestModel(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Model request failed: ${response.status}`);
  }
  return body;
}

function modelErrorMessage(error) {
  if (/OPENROUTER_API_KEY|OPENAI_API_KEY/i.test(error.message)) {
    return '模型还没接上：请在启动本机服务前设置 OPENROUTER_API_KEY，然后重启 Inner Notes。';
  }
  return `模型请求失败：${error.message}`;
}

async function analyzeCurrent() {
  const entry = selectedEntry();
  if (!entry?.body?.trim()) {
    setSaveStatus('想到什么写什么，不用完整。');
    return;
  }

  setSaveStatus('我在读...');
  try {
    const payload = await requestModel('/api/model-read-response', {
      entry,
      history: state.entries.filter((item) => item.id !== entry.id),
    });
    updateSelectedEntry((current) => {
      current.readResponse = payload.readResponse || null;
    });
    setSaveStatus(payload.readResponse?.response ? '读完了' : '写完后，我可以陪你看一遍。');
  } catch (error) {
    setSaveStatus(modelErrorMessage(error));
  }
  render();
  saveCurrentEntry(false);
}

async function sendChat() {
  const input = document.querySelector('[data-chat-input]');
  const text = input?.value.trim();
  if (!text) return;

  const createdAt = new Date().toISOString();
  updateSelectedEntry((entry) => {
    entry.chatMessages = entry.chatMessages || [];
    entry.chatMessages.push({ role: 'user', text, createdAt });
  });
  if (input) input.value = '';
  render();

  setSaveStatus('我在想...');
  const entry = selectedEntry();
  try {
    const payload = await requestModel('/api/model-reply', {
      userInput: text,
      entry,
      recentMessages: entry?.chatMessages || [],
    });
    const reply = payload.reply || {};
    updateSelectedEntry((current) => {
      current.chatMessages = current.chatMessages || [];
      current.chatMessages.push({
        role: 'assistant',
        text: reply.text || '',
        sections: reply.mode === 'structured' ? {
          reaction: reply.reaction,
          thinking: reply.thinking,
          conclusion: reply.conclusion,
        } : undefined,
        source: payload.source,
        model: payload.model,
        createdAt: new Date().toISOString(),
      });
    });
    setSaveStatus(`已回复${payload.model ? ` · ${payload.model}` : ''}`);
  } catch (error) {
    updateSelectedEntry((current) => {
      current.chatMessages = current.chatMessages || [];
      current.chatMessages.push({
        role: 'assistant',
        text: modelErrorMessage(error),
        source: 'system',
        createdAt: new Date().toISOString(),
      });
    });
    setSaveStatus(modelErrorMessage(error));
  }
  render();
  saveCurrentEntry(false);
}

function retainChat() {
  const entry = selectedEntry();
  const existing = entry?.retainedConversations || [];
  const next = retainConversation(existing, entry?.chatMessages || []);
  if (next === existing || next.length === existing.length) {
    setSaveStatus('这段还太短，先不用放进日记。');
    return;
  }
  updateSelectedEntry((current) => {
    current.retainedConversations = next;
  });
  setSaveStatus('已放进这篇日记');
  render();
  saveCurrentEntry(false);
}

async function deleteEntry(entryId = '') {
  const entry = state.entries.find((item) => item.id === entryId) || selectedEntry();
  if (!entry) return;
  if (!window.confirm(`确定删除 ${formatShortDate(entry.id)} 这篇日记吗？这会同时删除对应的本地文本文件。`)) return;

  let fileDeleteError = null;
  try {
    const response = await fetch(`/api/journal-entry?id=${encodeURIComponent(entry.id)}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Delete failed: ${response.status}`);
  } catch (error) {
    fileDeleteError = error;
  }

  const wasSelected = state.selectedEntryId === entry.id;
  state.entries = deleteEntryById(state.entries, entry.id).map(normalizeEntry);
  let createdReplacement = false;
  if (!state.entries.length) {
    const result = ensureEntryForDate([], new Date());
    state.entries = result.entries.map(normalizeEntry);
    state.selectedEntryId = result.entry.id;
    createdReplacement = true;
  } else if (wasSelected || !state.entries.some((item) => item.id === state.selectedEntryId)) {
    state.selectedEntryId = state.entries[0].id;
  }
  refreshAutomaticSummaries();
  state.backup.status = fileDeleteError
    ? `已从列表删除；本地文件删除失败：${fileDeleteError.message}`
    : '已删除';
  saveState();
  render();
  if (createdReplacement) saveCurrentEntry(false);
}

function deleteRetained(id) {
  if (!id) return;
  if (!window.confirm('确定把这段保存的对话移出这篇日记吗？')) return;
  updateSelectedEntry((entry) => {
    const updated = deleteRetainedConversationById(entry, id);
    entry.retainedConversations = updated.retainedConversations;
  });
  render();
  saveCurrentEntry(false);
}

function toggleEntryMenu(target) {
  const menu = target.closest('.entry-menu');
  if (!menu) return;
  const shouldOpen = !menu.open;
  document.querySelectorAll('.entry-menu[open]').forEach((item) => {
    if (item !== menu) {
      item.open = false;
      item.classList.remove('visible');
    }
  });
  menu.open = shouldOpen;
  menu.classList.toggle('visible', shouldOpen);
}

function selectEntry(id) {
  if (id !== state.selectedEntryId) discardBlankEntry(state.selectedEntryId);
  state.selectedEntryId = id;
  state.selectedReviewId = '';
  state.view = 'entry';
  ui.mobilePanel = 'main';
  saveState();
  render();
}

function selectReview(id) {
  if (!state.summaries.some((summary) => summary.id === id)) return;
  discardBlankEntry(state.selectedEntryId);
  state.selectedReviewId = id;
  state.view = 'review';
  ui.mobilePanel = 'main';
  saveState();
  render();
}

function startToday() {
  const result = createEntryForDate(state.entries, new Date());
  state.entries = result.entries.map(normalizeEntry);
  state.selectedEntryId = result.entry.id;
  state.selectedReviewId = '';
  state.view = 'entry';
  ui.mobilePanel = 'main';
  refreshAutomaticSummaries();
  saveState();
  render();
}

function quickNote() {
  const before = state.entries.length;
  const result = createEntryForDate(state.entries, new Date());
  const normalized = normalizeEntry({
    ...result.entry,
    title: '先记一句',
  });
  state.entries = result.entries
    .map((entry) => (entry.id === normalized.id ? normalized : normalizeEntry(entry)));
  state.selectedEntryId = normalized.id;
  state.selectedReviewId = '';
  state.view = 'entry';
  ui.mobilePanel = 'main';
  refreshAutomaticSummaries();
  saveState();
  render();
  if (state.entries.length !== before) saveCurrentEntry(false);
}

function openCover() {
  discardBlankEntry(state.selectedEntryId);
  state.view = 'cover';
  state.selectedReviewId = '';
  ui.mobilePanel = 'main';
  saveState();
  render();
}

function openLatest() {
  discardBlankEntry(state.selectedEntryId);
  const latest = latestEntry();
  if (latest) {
    selectEntry(latest.id);
    return;
  }
  state.view = 'cover';
  state.selectedEntryId = '';
  saveState();
  render();
}

function openMonth(month = '') {
  discardBlankEntry(state.selectedEntryId);
  const latest = monthEntries(month)[0];
  if (latest) {
    selectEntry(latest.id);
    return;
  }
  state.view = 'cover';
  state.selectedEntryId = '';
  saveState();
  render();
}

function toggleMobilePanel(panel = 'main') {
  ui.mobilePanel = ui.mobilePanel === panel ? 'main' : panel;
  render();
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    setSaveStatus('当前浏览器不支持通知');
    return;
  }
  const permission = await Notification.requestPermission();
  state.settings.notificationsEnabled = permission === 'granted';
  saveState();
  scheduleReminders();
  setSaveStatus(permission === 'granted' ? '提醒已开启' : '提醒未授权');
}

function scheduleReminders() {
  reminderTimers.forEach((timer) => window.clearTimeout(timer));
  reminderTimers = [];
  if (!state.settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;

  reminderTimers.push(scheduleDailyNotification(state.settings.morningReminder, '早上好。今天先留意一个小模式就够。'));
  reminderTimers.push(scheduleDailyNotification(state.settings.eveningReminder, '今天可以写几句。乱一点也可以。'));
}

function scheduleDailyNotification(time, body) {
  const [hour, minute] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return window.setTimeout(() => {
    new Notification('Inner Notes', { body });
    scheduleReminders();
  }, next.getTime() - now.getTime());
}

function toggleMood(mood) {
  updateSelectedEntry((entry) => {
    entry.prompts = normalizePrompts(entry.prompts);
    const current = new Set(entry.prompts.mood);
    if (current.has(mood)) current.delete(mood);
    else current.add(mood);
    entry.prompts.mood = [...current];
  });
  ui.moodPickerOpen = true;
  render();
}

function setEnergy(energy) {
  updateSelectedEntry((entry) => {
    entry.prompts = normalizePrompts(entry.prompts);
    entry.prompts.energy = entry.prompts.energy === energy ? '' : energy;
  });
  render();
}

function toggleExercise(groupId, itemId) {
  updateSelectedEntry((entry) => {
    entry.prompts = normalizePrompts(entry.prompts);
    if (!entry.prompts.exercises[groupId]) entry.prompts.exercises[groupId] = {};
    entry.prompts.exercises[groupId][itemId] = !entry.prompts.exercises[groupId][itemId];
  });
  render();
}

function toggleTomorrow() {
  updateSelectedEntry((entry) => {
    entry.prompts = normalizePrompts(entry.prompts);
    entry.prompts.tomorrow.done = !entry.prompts.tomorrow.done;
  });
  render();
}

function updateEntryById(entryId, updater, shouldRender = true) {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  const updated = normalizeEntry(entry);
  updater(updated);
  updated.updatedAt = new Date().toISOString();
  state.entries = state.entries.map((item) => (item.id === updated.id ? updated : item));
  refreshAutomaticSummaries();
  saveState();
  scheduleJournalSave();
  if (shouldRender) render();
}

function ensureTodoInEntry(entry, todoId, text = '') {
  entry.prompts = normalizePrompts(entry.prompts);
  if (todoId === 'new-todo') {
    const todo = { id: makeTodoId(), text, done: false };
    entry.prompts.todos.push(todo);
    return todo;
  }
  let todo = entry.prompts.todos.find((item) => item.id === todoId);
  if (!todo) {
    todo = { id: todoId || makeTodoId(), text, done: false };
    entry.prompts.todos.push(todo);
  }
  return todo;
}

function updateTodoText(entryId, todoId, text) {
  updateEntryById(entryId, (entry) => {
    const todo = ensureTodoInEntry(entry, todoId, text);
    todo.text = text;
    entry.prompts.todos = entry.prompts.todos.filter((item) => item.text.trim() || item.done);
  }, false);
}

function toggleTodo(entryId, todoId) {
  updateEntryById(entryId, (entry) => {
    const todo = ensureTodoInEntry(entry, todoId);
    todo.done = !todo.done;
    entry.prompts.todos = entry.prompts.todos.filter((item) => item.text.trim() || item.done);
  });
}

function addTodoAfter(entryId, todoId) {
  updateEntryById(entryId, (entry) => {
    const current = normalizePrompts(entry.prompts).todos;
    const next = { id: makeTodoId(), text: '', done: false };
    if (!current.length || todoId === 'new-todo') {
      entry.prompts.todos = [next];
      return;
    }
    const index = current.findIndex((todo) => todo.id === todoId);
    const insertAt = index >= 0 ? index + 1 : current.length;
    current.splice(insertAt, 0, next);
    entry.prompts.todos = current;
  });
}

function setArchiveFilter(type, value = '') {
  state.archiveFilter = normalizeArchiveFilter({ type, value });
  const visibleEntries = entriesForArchiveFilter();
  if (visibleEntries.length && !visibleEntries.some((entry) => entry.id === state.selectedEntryId)) {
    state.selectedEntryId = visibleEntries[0].id;
  }
  saveState();
  render();
}

function insertTextareaNewline(input) {
  const start = Number.isInteger(input.selectionStart) ? input.selectionStart : input.value.length;
  const end = Number.isInteger(input.selectionEnd) ? input.selectionEnd : input.value.length;
  input.value = `${input.value.slice(0, start)}\n${input.value.slice(end)}`;
  const cursor = start + 1;
  if (typeof input.setSelectionRange === 'function') {
    input.setSelectionRange(cursor, cursor);
  } else {
    input.selectionStart = cursor;
    input.selectionEnd = cursor;
  }
}

function makeCommentId() {
  return `comment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nodeClosest(node, selector) {
  if (!node) return null;
  if (typeof node.closest === 'function') return node.closest(selector);
  return node.parentElement?.closest?.(selector) || null;
}

function hideSelectionToolbar() {
  const toolbar = document.querySelector?.('[data-selection-toolbar]');
  if (!toolbar) return;
  toolbar.hidden = true;
}

function hideCursorToolbars() {
  document.querySelectorAll?.('[data-insert-toolbar], [data-block-toolbar]').forEach((toolbar) => {
    toolbar.open = false;
    toolbar.classList?.remove('visible');
  });
}

function clearCursorToolbarHideTimer() {
  if (cursorToolbarHideTimer) {
    window.clearTimeout?.(cursorToolbarHideTimer);
    cursorToolbarHideTimer = null;
  }
}

function hideCursorToolbarsSoon() {
  clearCursorToolbarHideTimer();
  cursorToolbarHideTimer = window.setTimeout?.(() => {
    cursorToolbarHideTimer = null;
    hideCursorToolbars();
  }, CURSOR_TOOLBAR_HIDE_DELAY);
}

function syncBodyEditor(editor = document.querySelector?.('.body-editor')) {
  if (!editor) return;
  updateSelectedEntry((entry) => {
    entry.body = (editor.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    entry.bodyHtml = sanitizeBodyHtml(editor.innerHTML || '');
  });
}

function restoreBodySelection() {
  if (!savedBodyRange || typeof document.getSelection !== 'function') return false;
  const selection = document.getSelection();
  if (!selection) return false;
  selection.removeAllRanges();
  selection.addRange(savedBodyRange);
  return true;
}

function selectedBodyText() {
  restoreBodySelection();
  if (typeof document.getSelection !== 'function') return '';
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return '';
  const range = selection.getRangeAt(0);
  const editor = nodeClosest(range.commonAncestorContainer, '.body-editor');
  if (!editor) return '';
  return selection.toString().trim();
}

function applyFormat(command) {
  restoreBodySelection();
  if (typeof document.execCommand !== 'function') return;
  if (command === 'highlight') {
    const applied = document.execCommand('hiliteColor', false, '#fff0a6');
    if (!applied) document.execCommand('backColor', false, '#fff0a6');
  } else {
    document.execCommand(command, false, null);
  }
  syncBodyEditor();
  hideSelectionToolbar();
}

function applyTextColor(color) {
  if (!textColors.includes(color)) return;
  restoreBodySelection();
  if (typeof document.execCommand !== 'function') return;
  document.execCommand('foreColor', false, color);
  syncBodyEditor();
  hideSelectionToolbar();
}

function normalizeBlockValue(value = '') {
  const normalized = String(value).toLowerCase().replace(/[<>]/g, '').trim();
  if (['h1', 'heading 1'].includes(normalized)) return 'h1';
  if (['h2', 'heading 2'].includes(normalized)) return 'h2';
  if (['h3', 'heading 3'].includes(normalized)) return 'h3';
  if (['blockquote', 'block quote'].includes(normalized)) return 'blockquote';
  if (['p', 'div', 'normal', 'paragraph'].includes(normalized)) return 'p';
  return normalized || 'p';
}

function currentBlockFormat() {
  if (typeof document.queryCommandValue !== 'function') return 'p';
  try {
    return normalizeBlockValue(document.queryCommandValue('formatBlock'));
  } catch {
    return 'p';
  }
}

function applyBlockFormat(block) {
  if (!blockFormats.some((item) => item.action === 'format-block' && item.block === block)) return;
  restoreBodySelection();
  if (typeof document.execCommand !== 'function') return;
  const nextBlock = block !== 'p' && currentBlockFormat() === block ? 'p' : block;
  document.execCommand('formatBlock', false, nextBlock);
  syncBodyEditor();
  hideSelectionToolbar();
  hideCursorToolbars();
}

function applyListFormat(list) {
  if (!['ul', 'ol'].includes(list)) return;
  restoreBodySelection();
  if (typeof document.execCommand !== 'function') return;
  document.execCommand(list === 'ul' ? 'insertUnorderedList' : 'insertOrderedList', false, null);
  syncBodyEditor();
  hideSelectionToolbar();
  hideCursorToolbars();
}

function closeInsertToolbar() {
  document.querySelectorAll?.('[data-insert-toolbar]').forEach((toolbar) => {
    toolbar.open = false;
    toolbar.classList?.remove('visible');
  });
}

function insertCallout(emoji = '🥛') {
  const icon = String(emoji || '🥛').trim().slice(0, 4) || '🥛';
  insertHtmlAtBodyCursor(`
    <div class="callout-block" data-block-kind="callout">
      <span class="callout-handle" contenteditable="true">${escapeHtml(icon)}</span>
      <div class="callout-content"><br></div>
    </div>
    <p><br></p>
  `);
  closeInsertToolbar();
}

function customDividerValue(target) {
  const input = target.closest?.('[data-insert-toolbar]')?.querySelector?.('[data-custom-divider]');
  return String(input?.value || '').trim();
}

function insertDivider(kind = 'line', target) {
  const preset = dividerPresets.find((item) => item.id === kind) || dividerPresets[0];
  if (preset.id === 'line') {
    insertHtmlAtBodyCursor('<hr class="soft-divider"><p><br></p>');
    closeInsertToolbar();
    return;
  }

  const pattern = preset.id === 'custom'
    ? customDividerValue(target) || preset.pattern
    : preset.pattern;
  insertHtmlAtBodyCursor(`<div class="soft-divider emoji-divider ${escapeHtml(preset.id)}" contenteditable="false"><span>${escapeHtml(pattern)}</span></div><p><br></p>`);
  closeInsertToolbar();
}

function currentBodySelectionRange() {
  if (typeof document.getSelection !== 'function') return null;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return nodeClosest(range.commonAncestorContainer, '.body-editor') ? range.cloneRange() : null;
}

function hasBodyTextSelection() {
  if (typeof document.getSelection !== 'function') return false;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  return Boolean(selection.toString().trim() && nodeClosest(range.commonAncestorContainer, '.body-editor'));
}

function bodyRangeFromPoint(x, y) {
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(x, y);
  }
  if (typeof document.caretPositionFromPoint === 'function') {
    const position = document.caretPositionFromPoint(x, y);
    if (position && typeof document.createRange === 'function') {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
}

function blockFromRange(range, editor) {
  let node = range?.startContainer || null;
  if (node?.nodeType === 3) node = node.parentElement;
  while (node && node !== editor) {
    const tagName = String(node.tagName || '').toLowerCase();
    if (['p', 'div', 'li', 'h1', 'h2', 'h3', 'blockquote'].includes(tagName)) return node;
    node = node.parentElement;
  }
  return editor;
}

function freeTextBlock(block, editor) {
  if (!block || block === editor) return true;
  return ['p', 'div'].includes(String(block.tagName || '').toLowerCase());
}

function blockHasText(block, editor) {
  if (!block || block === editor) {
    const bodyText = String(editor?.innerText || editor?.textContent || '').replace(/\u200b/g, '').trim();
    return Boolean(bodyText);
  }
  return Boolean(String(block.innerText || block.textContent || '').replace(/\u200b/g, '').trim());
}

function textAfterCaret(range, block) {
  if (!range || !block || typeof range.cloneRange !== 'function') return '';
  try {
    const probe = range.cloneRange();
    probe.selectNodeContents(block);
    probe.setStart(range.startContainer, range.startOffset);
    return probe.toString();
  } catch {
    return '';
  }
}

function setCursorToolbarPosition(toolbar, range, block) {
  if (!toolbar || !range) return;
  const shell = toolbar.closest?.('.body-shell');
  if (!shell || typeof shell.getBoundingClientRect !== 'function') return;
  const shellRect = shell.getBoundingClientRect();
  const rangeRect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : null;
  const blockRect = typeof block?.getBoundingClientRect === 'function'
    ? block.getBoundingClientRect()
    : null;
  const top = (rangeRect?.top || blockRect?.top || shellRect.top) - shellRect.top;
  toolbar.style.top = `${Math.max(0, top)}px`;
}

function showCursorToolbar(selector, range, block) {
  const toolbar = document.querySelector?.(selector);
  if (!toolbar) return;
  toolbar.classList?.add('visible');
  setCursorToolbarPosition(toolbar, range, block);
}

function cursorToolbarIsOpen() {
  return [...(document.querySelectorAll?.('[data-insert-toolbar], [data-block-toolbar]') || [])]
    .some((toolbar) => toolbar.open);
}

function handleEditorMousemove(event) {
  const toolbarTarget = event.target.closest?.('[data-insert-toolbar], [data-block-toolbar]');
  if (toolbarTarget || cursorToolbarIsOpen()) {
    clearCursorToolbarHideTimer();
    return;
  }

  const editor = event.target.closest?.('.body-editor');
  if (!editor) {
    hideCursorToolbarsSoon();
    return;
  }
  if (hasBodyTextSelection()) return;
  clearCursorToolbarHideTimer();

  const range = bodyRangeFromPoint(event.clientX, event.clientY) || currentBodySelectionRange();
  if (!range || !nodeClosest(range.commonAncestorContainer, '.body-editor')) {
    hideCursorToolbarsSoon();
    return;
  }

  savedBodyRange = range.cloneRange();
  const block = blockFromRange(range, editor);
  hideCursorToolbars();
  if (freeTextBlock(block, editor) && !blockHasText(block, editor)) {
    showCursorToolbar('[data-insert-toolbar]', range, block);
  } else {
    showCursorToolbar('[data-block-toolbar]', range, block);
  }
}

function imageFilesFromPaste(event) {
  const items = [...(event.clipboardData?.items || [])];
  const files = items
    .filter((item) => item.kind === 'file' && item.type?.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (files.length) return files;
  return [...(event.clipboardData?.files || [])].filter((file) => file.type?.startsWith('image/'));
}

function isSupportedImageDataUrl(dataUrl = '') {
  return /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(String(dataUrl));
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function insertHtmlAtBodyCursor(html) {
  restoreBodySelection();
  if (typeof document.execCommand !== 'function') return;
  document.execCommand('insertHTML', false, html);
  syncBodyEditor();
}

async function uploadPastedImage(file, dataUrl) {
  const entry = selectedEntry();
  const response = await fetch('/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entryId: entry?.id || dateKey(new Date()),
      name: file.name || 'pasted-image',
      type: file.type || '',
      dataUrl,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false || !payload.src) {
    throw new Error(payload.error || `Upload failed: ${response.status}`);
  }
  return payload.src;
}

async function handlePaste(event) {
  const editor = event.target.closest?.('.body-editor');
  if (!editor) return;
  const files = imageFilesFromPaste(event);
  if (!files.length) return;

  event.preventDefault();
  savedBodyRange = currentBodySelectionRange() || savedBodyRange;
  setSaveStatus('正在插入图片...');

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    if (!isSupportedImageDataUrl(dataUrl)) continue;
    let src = dataUrl;
    try {
      src = await uploadPastedImage(file, dataUrl);
    } catch {
      src = dataUrl;
    }
    const alt = escapeHtml(file.name || '粘贴的图片');
    insertHtmlAtBodyCursor(`<figure class="pasted-image"><img src="${escapeHtml(src)}" alt="${alt}"></figure><br>`);
  }

  setSaveStatus('图片已插入，正在保存...');
}

function startCommentFromSelection() {
  const quote = selectedBodyText();
  if (!quote) {
    setSaveStatus('先选中一段正文。');
    return;
  }
  if (typeof document.execCommand === 'function') {
    document.execCommand('hiliteColor', false, '#fff0a6');
    syncBodyEditor();
  }
  ui.pendingComment = {
    quote,
    createdAt: new Date().toISOString(),
  };
  hideSelectionToolbar();
  render();
  window.setTimeout?.(() => document.querySelector?.('[data-comment-input]')?.focus?.(), 0);
}

function submitPendingComment() {
  const input = document.querySelector?.('[data-comment-input]');
  const text = input?.value.trim();
  if (!ui.pendingComment || !text) return;
  const comment = {
    id: makeCommentId(),
    quote: ui.pendingComment.quote,
    text,
    createdAt: new Date().toISOString(),
    manual: true,
    resolved: false,
  };
  updateSelectedEntry((entry) => {
    entry.comments = normalizeComments([...(entry.comments || []), comment]);
  });
  ui.pendingComment = null;
  render();
  saveCurrentEntry(false);
}

function cancelPendingComment() {
  ui.pendingComment = null;
  render();
}

function resolveComment(id) {
  if (!id) return;
  updateSelectedEntry((entry) => {
    entry.comments = normalizeComments(entry.comments || []).filter((comment) => comment.id !== id);
  });
  render();
  saveCurrentEntry(false);
}

function handleKeydown(event) {
  if (event.key !== 'Enter') return;
  const todoInput = event.target.closest?.('[data-todo-input]');
  if (todoInput) {
    event.preventDefault();
    addTodoAfter(todoInput.dataset.entryId, todoInput.dataset.todoText);
    return;
  }

  const commentInput = event.target.closest?.('[data-comment-input]');
  if (!commentInput) return;
  if (event.shiftKey) return;
  event.preventDefault();
  submitPendingComment();
}

function handleMouseDown(event) {
  if (event.target.closest?.('[data-selection-toolbar], [data-insert-toolbar], [data-block-toolbar]')) {
    event.preventDefault();
  }
}

function handleSelectionChange() {
  const toolbar = document.querySelector?.('[data-selection-toolbar]');
  if (!toolbar || typeof document.getSelection !== 'function') return;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) {
    savedBodyRange = null;
    hideSelectionToolbar();
    hideCursorToolbars();
    return;
  }
  const range = selection.getRangeAt(0);
  const editor = nodeClosest(range.commonAncestorContainer, '.body-editor');
  if (!editor) {
    savedBodyRange = null;
    hideSelectionToolbar();
    hideCursorToolbars();
    return;
  }

  savedBodyRange = range.cloneRange();
  if (selection.isCollapsed || !selection.toString().trim()) {
    hideSelectionToolbar();
    return;
  }

  hideCursorToolbars();
  const rect = typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : { left: 0, right: 0, top: 0 };
  toolbar.hidden = false;
  toolbar.style.left = `${Math.max(12, rect.left + ((rect.right - rect.left) / 2) + (window.scrollX || 0))}px`;
  toolbar.style.top = `${Math.max(12, rect.top + (window.scrollY || 0) - 48)}px`;
}

function handleMouseout(event) {
  const row = event.target.closest?.('.day-row');
  if (!row || row.contains(event.relatedTarget)) return;
  const menu = row.querySelector?.('.entry-menu[open]');
  if (menu) {
    menu.open = false;
    menu.classList.remove('visible');
  }
}

function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const id = target.dataset.id;

  if (['delete-entry', 'delete-retained', 'toggle-entry-menu', 'select-review', 'open-cover', 'open-latest', 'open-month', 'quick-note', 'toggle-mobile-panel', 'toggle-mood-picker', 'format-block', 'format-list', 'insert-callout', 'insert-divider', 'format-bold', 'format-italic', 'format-highlight', 'format-color', 'start-comment', 'submit-comment', 'cancel-comment', 'resolve-comment', 'switch-account', 'logout'].includes(action)) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (action === 'toggle-entry-menu') {
    toggleEntryMenu(target);
    return;
  }
  if (action === 'start-today') startToday();
  if (action === 'quick-note') quickNote();
  if (action === 'open-cover') openCover();
  if (action === 'open-latest') openLatest();
  if (action === 'open-month') openMonth(target.dataset.month);
  if (action === 'toggle-mobile-panel') toggleMobilePanel(target.dataset.panel);
  if (action === 'select-entry') selectEntry(id);
  if (action === 'select-review') selectReview(id);
  if (action === 'toggle-mood-picker') {
    ui.moodPickerOpen = !ui.moodPickerOpen;
    render();
  }
  if (action === 'toggle-mood') toggleMood(target.dataset.mood);
  if (action === 'set-energy') setEnergy(target.dataset.energy);
  if (action === 'toggle-exercise') toggleExercise(target.dataset.exerciseGroup, target.dataset.exerciseId);
  if (action === 'toggle-tomorrow') toggleTomorrow();
  if (action === 'toggle-todo') toggleTodo(target.dataset.entryId, target.dataset.todoId);
  if (action === 'set-archive-filter') setArchiveFilter(target.dataset.filterType, target.dataset.filterValue);
  if (action === 'format-block') applyBlockFormat(target.dataset.block);
  if (action === 'format-list') applyListFormat(target.dataset.list);
  if (action === 'insert-callout') insertCallout(target.dataset.emoji);
  if (action === 'insert-divider') insertDivider(target.dataset.divider, target);
  if (action === 'format-bold') applyFormat('bold');
  if (action === 'format-italic') applyFormat('italic');
  if (action === 'format-highlight') applyFormat('highlight');
  if (action === 'format-color') applyTextColor(target.dataset.color);
  if (action === 'start-comment') startCommentFromSelection();
  if (action === 'submit-comment') submitPendingComment();
  if (action === 'cancel-comment') cancelPendingComment();
  if (action === 'resolve-comment') resolveComment(id);
  if (action === 'analyze') analyzeCurrent();
  if (action === 'save-entry') saveCurrentEntry(true);
  if (action === 'send-chat') sendChat();
  if (action === 'retain-chat') retainChat();
  if (action === 'delete-entry') deleteEntry(id);
  if (action === 'delete-retained') deleteRetained(id);
  if (action === 'backup-now') backupNow(true);
  if (action === 'enable-notifications') enableNotifications();
  if (action === 'switch-account') logout();
  if (action === 'logout') logout();
}

async function loadJournalFiles() {
  try {
    const response = await fetch('/api/journals');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Load failed: ${response.status}`);
    state.backup.folder = payload.folder || state.backup.folder;
    state.summaries = Array.isArray(payload.summaries) ? payload.summaries : state.summaries;
    if (payload.entries?.length) {
      state.entries = payload.entries.map(normalizeEntry);
      state.selectedEntryId = state.entries.some((entry) => entry.id === state.selectedEntryId)
        ? state.selectedEntryId
        : state.entries[0].id;
      state.backup.status = '本地文件已打开';
    } else if (state.entries.length) {
      await saveAllEntries();
    }
  } catch (error) {
    state.backup.status = `本地文件未连接：${error.message}`;
  }
  refreshAutomaticSummaries();
  if (state.selectedReviewId && !state.summaries.some((summary) => summary.id === state.selectedReviewId)) {
    state.selectedReviewId = '';
  }
  saveState();
}

async function initializeApp() {
  app.innerHTML = '<div class="loading">正在打开日记本...</div>';
  const hasSession = await loadCurrentUser();
  if (!hasSession) return;
  await loadJournalFiles();
  render();
  scheduleReminders();
}

document.addEventListener('input', handleInput);
document.addEventListener('keydown', handleKeydown);
document.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mouseout', handleMouseout);
document.addEventListener('mousemove', handleEditorMousemove);
document.addEventListener('click', handleClick);
document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('paste', handlePaste);

initializeApp();
