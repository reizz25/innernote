import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

function makeStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function makeJsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

async function mountApp(entries, mountOptions = {}) {
  let renderedHtml = '';
  let renderCount = 0;
  let activeElement = null;
  const fetchCalls = [];
  const app = {
    get innerHTML() {
      return renderedHtml;
    },
    set innerHTML(value) {
      renderCount += 1;
      renderedHtml = String(value);
    },
  };
  const listeners = {};
  const delayedTimeouts = new Map();
  let timeoutId = 0;
  let confirmCount = 0;
  let modelReplyCount = 0;
  const execCommandCalls = [];
  const toolbarElements = {
    insert: {
      open: false,
      style: {},
      classList: {
        added: new Set(),
        removed: new Set(),
        add(name) {
          toolbarElements.insert.classList.added.add(name);
          toolbarElements.insert.classList.removed.delete(name);
        },
        remove(name) {
          toolbarElements.insert.classList.removed.add(name);
          toolbarElements.insert.classList.added.delete(name);
        },
        contains(name) {
          return toolbarElements.insert.classList.added.has(name);
        },
      },
      closest(selector) {
        return selector === '.body-shell' ? mountOptions.bodyShell : null;
      },
    },
    block: {
      open: false,
      style: {},
      classList: {
        added: new Set(),
        removed: new Set(),
        add(name) {
          toolbarElements.block.classList.added.add(name);
          toolbarElements.block.classList.removed.delete(name);
        },
        remove(name) {
          toolbarElements.block.classList.removed.add(name);
          toolbarElements.block.classList.added.delete(name);
        },
        contains(name) {
          return toolbarElements.block.classList.added.has(name);
        },
      },
      closest(selector) {
        return selector === '.body-shell' ? mountOptions.bodyShell : null;
      },
    },
  };
  const sideNotesInput = {
    value: '这里是我自己的旁注',
    dataset: { sideNotes: '' },
    selectionStart: 2,
    selectionEnd: 2,
    closest(selector) {
      return selector === '[data-side-notes]' ? sideNotesInput : null;
    },
    setSelectionRange(start, end) {
      sideNotesInput.selectionStart = start;
      sideNotesInput.selectionEnd = end;
    },
  };

  const defaultLocalStorage = mountOptions.useAppDefaultView
    ? {}
    : { 'inner-notes-state-v1': JSON.stringify({ view: mountOptions.initialView || 'entry' }) };
  global.localStorage = makeStorage({
    ...defaultLocalStorage,
    ...(mountOptions.localStorageValues || {}),
  });
  global.fetch = async (url, requestOptions = {}) => {
    fetchCalls.push({ url: String(url), method: requestOptions.method || 'GET' });
    if (url === '/api/journals') {
      if (mountOptions.journalsFail) {
        return makeJsonResponse({ ok: false, error: 'local files unavailable' }, false, 500);
      }
      return makeJsonResponse({
        ok: true,
        folder: '/tmp/inner-notes-test',
        entries,
        summaries: mountOptions.summaries || [],
      });
    }
    if (url === '/api/journal-entry' && requestOptions.method === 'POST') {
      return makeJsonResponse({ ok: true, folder: '/tmp/inner-notes-test' });
    }
    if (String(url).startsWith('/api/journal-entry') && requestOptions.method === 'DELETE') {
      if (mountOptions.deleteFails) {
        return makeJsonResponse({ ok: false, error: 'file was already gone' }, false, 404);
      }
      return makeJsonResponse({ ok: true });
    }
    if (url === '/api/model-reply') {
      modelReplyCount += 1;
      return makeJsonResponse({
        ok: true,
        reply: { mode: 'plain', text: '我在。' },
        model: 'test-model',
      });
    }
    return makeJsonResponse({ ok: false, error: `Unhandled fetch ${url}` }, false, 404);
  };
  global.window = {
    clearTimeout(id) {
      delayedTimeouts.delete(id);
    },
    setTimeout(callback, delay = 0) {
      timeoutId += 1;
      const id = timeoutId;
      if (delay === 650) {
        delayedTimeouts.set(id, callback);
        return id;
      }
      queueMicrotask(callback);
      return id;
    },
    confirm() {
      confirmCount += 1;
      return Boolean(mountOptions.confirmDeletes);
    },
  };
  global.document = {
    get activeElement() {
      return activeElement;
    },
    querySelector(selector) {
      if (selector === '[data-side-notes]') return sideNotesInput;
      if (selector === '[data-insert-toolbar]') return toolbarElements.insert;
      if (selector === '[data-block-toolbar]') return toolbarElements.block;
      return selector === '#app' ? app : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-insert-toolbar], [data-block-toolbar]') {
        return [toolbarElements.insert, toolbarElements.block];
      }
      if (selector === '[data-insert-toolbar]') return [toolbarElements.insert];
      if (selector === '[data-block-toolbar]') return [toolbarElements.block];
      return [];
    },
    execCommand(command, showDefaultUi, value) {
      execCommandCalls.push([command, showDefaultUi, value]);
      return true;
    },
    queryCommandValue(command) {
      return mountOptions.queryCommandValue?.[command] || '';
    },
    queryCommandState(command) {
      return Boolean(mountOptions.queryCommandState?.[command]);
    },
    getSelection() {
      return mountOptions.selection || null;
    },
    caretRangeFromPoint(x, y) {
      return mountOptions.caretRangeFromPoint?.(x, y) || null;
    },
    caretPositionFromPoint(x, y) {
      return mountOptions.caretPositionFromPoint?.(x, y) || null;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
  };

  const appUrl = `${pathToFileURL(resolve('src/app.js')).href}?case=${Date.now()}-${Math.random()}`;
  await import(appUrl);
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  return {
    app,
    sideNotesInput,
    listeners,
    getRenderCount: () => renderCount,
    setActiveElement: (element) => {
      activeElement = element;
    },
    getConfirmCount: () => confirmCount,
    getModelReplyCount: () => modelReplyCount,
    getExecCommandCalls: () => execCommandCalls,
    getFetchCalls: () => fetchCalls,
    toolbarElements,
    runDelayedTimeouts: () => {
      const callbacks = [...delayedTimeouts.values()];
      delayedTimeouts.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

const entries = [{
  id: '2026-06-15',
  title: '今天想记下什么？',
  firstRecordedAt: '2026-06-15T18:51:00.000Z',
  updatedAt: '2026-06-15T18:54:00.000Z',
  prompts: { mood: ['平静'], energy: '尚可', tomorrow: { done: false, text: '' } },
  body: '测试日记测试日记',
  readResponse: null,
  comments: [{ id: 'comment-1', quote: '测试日记', text: '这里需要之后回看。', createdAt: '2026-06-15T18:55:00.000Z' }],
  chatMessages: [],
  sideNotes: '这里是我自己的旁注',
  retainedConversations: [{
    id: 'memory-1',
    title: '关于测试的对话',
    summary: '留下一段测试对话。',
    messages: [
      { role: 'user', text: '测试一下' },
      { role: 'assistant', text: '我在。' },
    ],
  }],
}];

test('entry delete controls are direct in the main actions and tucked behind each sidebar entry menu', async () => {
  const { app } = await mountApp(entries);

  assert.match(app.innerHTML, /class="button danger" data-action="delete-entry"[^>]*>删除<\/button>/);
  assert.doesNotMatch(app.innerHTML, /<details class="more-menu">[\s\S]*删除这篇/);
  assert.match(app.innerHTML, /class="entry-menu"/);
  assert.match(app.innerHTML, /data-action="toggle-entry-menu"/);
  assert.match(app.innerHTML, /data-action="delete-entry" data-id="2026-06-15"[^>]*>删除<\/button>/);
});

test('deleting a stale sidebar entry removes it locally even when its file is already gone', async () => {
  const staleEntry = {
    ...entries[0],
    id: '2026-06-24-011305',
    firstRecordedAt: '2026-06-23T17:13:05.000Z',
    body: '',
    prompts: { mood: [], todos: [] },
  };
  const { app, listeners, getFetchCalls } = await mountApp([entries[0], staleEntry], {
    confirmDeletes: true,
    deleteFails: true,
  });

  const target = {
    dataset: { action: 'delete-entry', id: staleEntry.id },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  assert.ok(getFetchCalls().some((call) => (
    call.method === 'DELETE' && call.url.includes(encodeURIComponent(staleEntry.id))
  )));
  assert.doesNotMatch(app.innerHTML, /2026-06-24-011305/);
});

test('legacy browser state cannot keep stale diary entries alive', async () => {
  const staleState = {
    entries: [{
      id: '2026-06-24-013405',
      title: '今天想记下什么？',
      firstRecordedAt: '2026-06-23T17:34:05.000Z',
      updatedAt: '2026-06-23T17:34:05.000Z',
      prompts: { mood: [] },
      body: '这是一条已经没有文件的旧记录',
    }],
    selectedEntryId: '2026-06-24-013405',
  };
  const { app } = await mountApp([], {
    journalsFail: true,
    localStorageValues: {
      'inner-notes-state-v1': JSON.stringify(staleState),
    },
  });

  assert.doesNotMatch(app.innerHTML, /这是一条已经没有文件的旧记录/);
  assert.doesNotMatch(app.innerHTML, /01:34/);
});

test('opening the app does not auto-create an empty diary when local files already exist', async () => {
  const { app } = await mountApp([{
    ...entries[0],
    id: '2026-06-24-001205',
    firstRecordedAt: '2026-06-23T16:12:05.000Z',
    body: '今天有几件事我觉得要记录下',
  }]);

  const rows = app.innerHTML.match(/class="day-row/g) || [];
  assert.equal(rows.length, 1);
  assert.doesNotMatch(app.innerHTML, /今天，先写一点/);
});

test('selected text toolbar only offers inline styles and comments', async () => {
  const { app, listeners } = await mountApp(entries);

  const toolbarHtml = app.innerHTML.match(/<div class="selection-toolbar"[\s\S]*?<\/div>/)?.[0] || '';
  assert.doesNotMatch(toolbarHtml, /block-type-menu/);
  assert.doesNotMatch(toolbarHtml, /data-action="format-block"/);
  assert.doesNotMatch(toolbarHtml, /data-action="format-list"/);
  assert.match(toolbarHtml, /data-action="format-bold"/);
  assert.match(toolbarHtml, /data-action="format-italic"/);
  assert.match(toolbarHtml, /data-action="format-highlight"/);
  assert.match(app.innerHTML, /data-action="format-color"/);
  assert.match(app.innerHTML, /data-color="#d84a4a"/);
  assert.match(toolbarHtml, /data-action="start-comment"/);
  assert.doesNotMatch(app.innerHTML, /data-action="insert-emoji"/);
  assert.doesNotMatch(app.innerHTML, /class="emoji-tools"/);
  assert.equal(typeof listeners.paste, 'function');
});

test('blank body renders separate plus insert and T block toolbars', async () => {
  const { app } = await mountApp([{
    ...entries[0],
    body: '',
    bodyHtml: '',
  }]);

  assert.match(app.innerHTML, /class="body-shell is-empty"/);
  assert.match(app.innerHTML, /class="insert-toolbar"/);
  assert.match(app.innerHTML, /aria-label="插入内容"/);
  assert.doesNotMatch(app.innerHTML, /data-action="insert-block"/);
  assert.doesNotMatch(app.innerHTML, /data-action="insert-list"/);
  assert.match(app.innerHTML, /data-action="insert-callout"[\s\S]*高亮块/);
  assert.match(app.innerHTML, /data-action="insert-divider"[\s\S]*data-divider="line"[\s\S]*普通线/);
  assert.match(app.innerHTML, /data-action="insert-divider"[\s\S]*data-divider="gem"[\s\S]*宝石线/);
  assert.match(app.innerHTML, /data-action="insert-divider"[\s\S]*data-divider="star"[\s\S]*星光线/);
  assert.match(app.innerHTML, /data-action="insert-divider"[\s\S]*data-divider="custom"[\s\S]*自定义/);
  assert.match(app.innerHTML, /class="block-toolbar"/);
  assert.match(app.innerHTML, /aria-label="段落类型"/);
  assert.match(app.innerHTML, /data-action="format-block"[\s\S]*data-block="h1"[\s\S]*H1/);
  assert.match(app.innerHTML, /data-action="format-list"[\s\S]*data-list="ul"[\s\S]*项目符号/);
  assert.match(app.innerHTML, /data-action="format-block"[\s\S]*data-block="blockquote"[\s\S]*引用/);
});

test('plus insert menu inserts callout blocks and compact dividers only', async () => {
  const { listeners, getExecCommandCalls } = await mountApp([{
    ...entries[0],
    body: '',
    bodyHtml: '',
  }]);

  const clickAction = (dataset) => {
    const target = {
      dataset,
      closest(selector) {
        return selector === '[data-action]' ? target : null;
      },
    };
    listeners.click({
      target,
      preventDefault() {},
      stopPropagation() {},
    });
  };

  clickAction({ action: 'insert-callout', emoji: '🥛' });
  clickAction({ action: 'insert-divider', divider: 'gem' });

  const calls = getExecCommandCalls();
  assert.equal(calls[0][0], 'insertHTML');
  assert.match(calls[0][2], /class="callout-block"/);
  assert.match(calls[0][2], /data-block-kind="callout"/);
  assert.match(calls[0][2], /class="callout-handle"/);
  assert.match(calls[0][2], /class="callout-content"/);
  assert.match(calls[0][2], /🥛/);
  assert.equal(calls[1][0], 'insertHTML');
  assert.match(calls[1][2], /class="soft-divider emoji-divider gem"/);
  assert.match(calls[1][2], /💎/);
  assert.equal(calls.length, 2);
});

test('block controls follow the hovered editor line instead of staying at the clicked position', async () => {
  const bodyShell = {
    getBoundingClientRect() {
      return { top: 100, left: 320 };
    },
  };
  const editor = {
    closest(selector) {
      return selector === '.body-editor' ? editor : null;
    },
  };
  const firstBlock = {
    tagName: 'P',
    innerText: '前面还有文字',
    textContent: '前面还有文字',
    parentElement: editor,
    getBoundingClientRect() {
      return { top: 132 };
    },
  };
  const blankBlock = {
    tagName: 'P',
    innerText: '',
    textContent: '',
    parentElement: editor,
    getBoundingClientRect() {
      return { top: 214 };
    },
  };
  const makeRange = (block, afterText = '') => ({
    startContainer: block,
    startOffset: 0,
    commonAncestorContainer: block,
    getBoundingClientRect() {
      return block.getBoundingClientRect();
    },
    cloneRange() {
      return {
        selectNodeContents() {},
        setStart() {},
        toString() {
          return afterText;
        },
      };
    },
  });
  let activeRange = makeRange(firstBlock, '还有文字');
  const { listeners, toolbarElements } = await mountApp(entries, {
    bodyShell,
    selection: null,
    caretRangeFromPoint() {
      return activeRange;
    },
  });

  listeners.mousemove({ target: editor, clientX: 500, clientY: 132 });
  assert.equal(toolbarElements.block.style.top, '32px');
  assert.equal(toolbarElements.block.classList.contains('visible'), true);
  assert.equal(toolbarElements.insert.classList.contains('visible'), false);

  activeRange = makeRange(blankBlock, '');
  listeners.mousemove({ target: editor, clientX: 500, clientY: 214 });
  assert.equal(toolbarElements.block.classList.contains('visible'), false);
  assert.equal(toolbarElements.insert.style.top, '114px');
  assert.equal(toolbarElements.insert.classList.contains('visible'), true);
});

test('block controls stay briefly while crossing the gap and then hide', async () => {
  const { listeners, toolbarElements, runDelayedTimeouts } = await mountApp(entries);
  toolbarElements.block.classList.add('visible');
  toolbarElements.insert.classList.add('visible');

  listeners.mousemove({
    target: {
      closest() {
        return null;
      },
    },
    clientX: 0,
    clientY: 0,
  });

  assert.equal(toolbarElements.block.classList.contains('visible'), true);
  assert.equal(toolbarElements.insert.classList.contains('visible'), true);

  runDelayedTimeouts();

  assert.equal(toolbarElements.block.classList.contains('visible'), false);
  assert.equal(toolbarElements.insert.classList.contains('visible'), false);
});

test('T block toolbar applies and toggles paragraph block formats', async () => {
  const { listeners, getExecCommandCalls } = await mountApp(entries);

  const headingTarget = {
    dataset: { action: 'format-block', block: 'h2' },
    closest(selector) {
      return selector === '[data-action]' ? headingTarget : null;
    },
  };
  listeners.click({
    target: headingTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  const listTarget = {
    dataset: { action: 'format-list', list: 'ul' },
    closest(selector) {
      return selector === '[data-action]' ? listTarget : null;
    },
  };
  listeners.click({
    target: listTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  const quoteTarget = {
    dataset: { action: 'format-block', block: 'blockquote' },
    closest(selector) {
      return selector === '[data-action]' ? quoteTarget : null;
    },
  };
  listeners.click({
    target: quoteTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.deepEqual(getExecCommandCalls(), [
    ['formatBlock', false, 'h2'],
    ['insertUnorderedList', false, null],
    ['formatBlock', false, 'blockquote'],
  ]);
});

test('clicking the same T block format restores normal paragraph', async () => {
  const { listeners, getExecCommandCalls } = await mountApp(entries, {
    queryCommandValue: { formatBlock: 'blockquote' },
  });

  const target = {
    dataset: { action: 'format-block', block: 'blockquote' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };

  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.deepEqual(getExecCommandCalls(), [
    ['formatBlock', false, 'p'],
  ]);
});

test('emotion picker uses diary-derived state words without decorative symbols', async () => {
  const { app, listeners } = await mountApp(entries);

  const target = {
    dataset: { action: 'toggle-mood-picker' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /data-mood="低产"[\s\S]*#低产/);
  assert.match(app.innerHTML, /data-mood="拖延"[\s\S]*#拖延/);
  assert.match(app.innerHTML, /data-mood="边界"[\s\S]*#边界/);
  assert.match(app.innerHTML, /data-mood="被看见"[\s\S]*#被看见/);
  assert.match(app.innerHTML, /data-mood="风险感"[\s\S]*#风险感/);
  assert.match(app.innerHTML, /data-mood="存在感"[\s\S]*#存在感/);
  assert.doesNotMatch(app.innerHTML, /class="mood-symbol"/);
  assert.doesNotMatch(app.innerHTML, /✦|☼|♡|☆|✺|◈|☁|◌|◇|※|⌁/);
});

test('todo list behaves like reminders and carries unfinished monthly items', async () => {
  const { app, listeners } = await mountApp([{
    ...entries[0],
    prompts: {
      ...entries[0].prompts,
      todos: [
        { id: 'todo-today', text: '今天先写一点', done: false },
        { id: 'todo-done', text: '已经完成', done: true },
      ],
    },
  }, {
    ...entries[0],
    id: '2026-06-10',
    firstRecordedAt: '2026-06-10T18:51:00.000Z',
    prompts: {
      ...entries[0].prompts,
      todos: [{ id: 'todo-old', text: '本月以前没完成', done: false }],
    },
  }]);

  assert.match(app.innerHTML, /今天的 todo/);
  assert.match(app.innerHTML, /本月未完成/);
  assert.match(app.innerHTML, /data-todo-text="todo-today"[\s\S]*value="今天先写一点"/);
  assert.match(app.innerHTML, /todo-item done[\s\S]*value="已经完成"/);
  assert.match(app.innerHTML, /本月以前没完成/);
  assert.match(app.innerHTML, /data-entry-id="2026-06-10"[\s\S]*data-todo-text="todo-old"[\s\S]*value="本月以前没完成"/);

  const toggleTarget = {
    dataset: { action: 'toggle-todo', entryId: '2026-06-15', todoId: 'todo-today' },
    closest(selector) {
      return selector === '[data-action]' ? toggleTarget : null;
    },
  };
  listeners.click({
    target: toggleTarget,
    preventDefault() {},
    stopPropagation() {},
  });
  assert.match(app.innerHTML, /todo-item done[\s\S]*data-todo-text="todo-today"/);

  const todoInput = {
    dataset: { todoInput: '', entryId: '2026-06-15', todoId: 'todo-today' },
    closest(selector) {
      return selector === '[data-todo-input]' ? todoInput : null;
    },
  };
  const beforeCount = (app.innerHTML.match(/data-todo-text=/g) || []).length;
  listeners.keydown({
    key: 'Enter',
    target: todoInput,
    metaKey: false,
    ctrlKey: false,
    preventDefault() {},
  });
  const afterCount = (app.innerHTML.match(/data-todo-text=/g) || []).length;
  assert.equal(afterCount, beforeCount + 1);

  const oldTodoInput = {
    dataset: { todoText: 'todo-old', entryId: '2026-06-10' },
    value: '历史 todo 已修改',
  };
  listeners.input({ target: oldTodoInput });
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  assert.match(app.innerHTML, /data-entry-id="2026-06-10"[\s\S]*value="历史 todo 已修改"/);
});

test('daily metrics render as lightweight inputs and update prompts', async () => {
  const { app, listeners } = await mountApp([{
    ...entries[0],
    prompts: {
      ...entries[0].prompts,
      metrics: { weight: '62.5', sleep: '7.5', phone: '3' },
    },
  }]);

  assert.match(app.innerHTML, /data-metric="weight"[\s\S]*value="62.5"/);
  assert.match(app.innerHTML, /data-metric="sleep"[\s\S]*value="7.5"/);
  assert.match(app.innerHTML, /data-metric="phone"[\s\S]*value="3"/);
  assert.match(app.innerHTML, /class="settle status-card"/);
  assert.match(app.innerHTML, /今天留一点状态/);

  const target = {
    dataset: { metric: 'sleep' },
    value: '8',
  };
  listeners.input({ target });
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  assert.match(app.innerHTML, /data-metric="sleep"[\s\S]*value="8"/);
});

test('energy UI is hidden and daily hip exercise checklist can be checked off', async () => {
  const { app, listeners } = await mountApp(entries);

  assert.doesNotMatch(app.innerHTML, /data-action="set-energy"/);
  assert.doesNotMatch(app.innerHTML, /能量不足/);
  assert.doesNotMatch(app.innerHTML, /情绪和能量/);
  assert.match(app.innerHTML, /<details class="exercise-details"/);
  assert.match(app.innerHTML, /每日锻炼/);
  assert.match(app.innerHTML, /髋关节系统锻炼/);
  assert.match(app.innerHTML, /骨盆前后倾（10次）/);
  assert.match(app.innerHTML, /臀桥（10次 × 2组）/);
  assert.match(app.innerHTML, /脚跟滑动（左右各8次）/);
  assert.match(app.innerHTML, /屈膝左右倒（左右各8次）/);
  assert.match(app.innerHTML, /蚌式开合（左右各10次）/);

  const target = {
    dataset: { action: 'toggle-exercise', exerciseGroup: 'hip', exerciseId: 'glute-bridge' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /data-exercise-id="glute-bridge"[\s\S]*todo-check checked/);
});

test('automatic save does not rerender while the diary body is focused', async () => {
  const { app, listeners, getRenderCount, setActiveElement } = await mountApp(entries);
  const before = getRenderCount();
  const bodyEditor = {
    dataset: { field: 'body' },
    innerText: '我正在写，不要刷新页面',
    innerHTML: '我正在写，不要刷新页面',
    isContentEditable: true,
    tagName: 'DIV',
  };

  setActiveElement(bodyEditor);
  listeners.input({ target: bodyEditor });
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  assert.equal(getRenderCount(), before);
  assert.match(app.innerHTML, /测试日记测试日记/);
  assert.doesNotMatch(app.innerHTML, /我正在写，不要刷新页面/);
});

test('start today creates another entry instead of limiting the day to one diary', async () => {
  const { app, listeners } = await mountApp([{
    ...entries[0],
    id: '2026-06-22',
    firstRecordedAt: '2026-06-22T00:12:00.000Z',
    body: '今天已经写过一篇。',
  }]);
  const beforeCount = (app.innerHTML.match(/class="day-row/g) || []).length;
  const target = {
    dataset: { action: 'start-today' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };

  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  const afterCount = (app.innerHTML.match(/class="day-row/g) || []).length;
  assert.equal(afterCount, beforeCount + 1);
  assert.match(app.innerHTML, /data-id="\d{4}-\d{2}-\d{2}-\d{6}/);
});

test('automatic review only shows the last completed week with its date range', async () => {
  const { app } = await mountApp([
    {
      ...entries[0],
      id: '2026-07-02',
      firstRecordedAt: '2026-07-02T01:31:00.000Z',
      body: '本周还没结束，先不生成回顾。',
    },
    {
      ...entries[0],
      id: '2026-06-25',
      firstRecordedAt: '2026-06-25T02:57:00.000Z',
      body: '今天有几件事，低产，焦虑，迷茫。',
    },
    {
      ...entries[0],
      id: '2026-06-24',
      firstRecordedAt: '2026-06-24T00:12:00.000Z',
      body: '消息很多，我回复之后还是会自责。',
    },
  ]);

  const reviewLabels = [...app.innerHTML.matchAll(/<button class="review-link [^"]*"[^>]*>([^<]+)<\/button>/g)]
    .map((match) => match[1]);
  assert.deepEqual(reviewLabels, ['上周回顾 · 6 月 22 日 - 6 月 28 日']);
  assert.match(app.innerHTML, /data-action="select-review" data-id="week-2026-06-22"/);
  assert.doesNotMatch(app.innerHTML, /这个月的回顾|6 月的回顾|这一周的回顾/);
});

test('sidebar defaults to every diary in reverse time order without archive filters', async () => {
  const { app } = await mountApp([
    {
      ...entries[0],
      id: '2026-06-17',
      firstRecordedAt: '2026-06-17T14:22:00.000Z',
      body: '六月这天写了一点。',
    },
    {
      ...entries[0],
      id: '2026-05-20',
      firstRecordedAt: '2026-05-20T14:22:00.000Z',
      body: '五月这天写了一点。',
    },
  ]);

  assert.doesNotMatch(app.innerHTML, /data-action="set-archive-filter"/);
  assert.doesNotMatch(app.innerHTML, />归档<\/div>/);
  assert.match(app.innerHTML, /data-archive-heading>全部记录<\/div>/);
  assert.match(app.innerHTML, /6 月 17 日[\s\S]*5 月 20 日/);
});

test('review links open the generated review in the main area', async () => {
  const { app, listeners } = await mountApp([
    {
      ...entries[0],
      id: '2026-06-24',
      firstRecordedAt: '2026-06-24T14:22:00.000Z',
      body: '消息很多，我回复之后还是会自责。',
    },
    {
      ...entries[0],
      id: '2026-06-25',
      firstRecordedAt: '2026-06-25T14:22:00.000Z',
      body: '今天也在处理消息，想把回复集中到固定窗口。',
    },
  ]);

  assert.match(app.innerHTML, /data-action="select-review" data-id="week-2026-06-22"/);
  const target = {
    dataset: { action: 'select-review', id: 'week-2026-06-22' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /<section class="paper review-paper"/);
  assert.match(app.innerHTML, /上周回顾 · 6 月 22 日 - 6 月 28 日/);
  assert.match(app.innerHTML, /本周共记录 2 天。/);
  assert.match(app.innerHTML, /消息和回复压力反复出现/);
});

test('saved weekly review files are shown instead of the lightweight auto review', async () => {
  const { app, listeners } = await mountApp([
    {
      ...entries[0],
      id: '2026-06-24',
      firstRecordedAt: '2026-06-24T14:22:00.000Z',
      body: '消息很多，我回复之后还是会自责。',
    },
  ], {
    summaries: [{
      id: 'week-2026-06-22',
      type: 'week',
      range: '2026-06-22 至 2026-06-28',
      entryCount: 4,
      summary: '这一周的主线是工作去向和表达边界。',
      patterns: ['职业去向的焦虑已经落在具体问题上。'],
      blindSpots: ['你可能把“没准备好”和“不值得开始”混在了一起。'],
      recovery: [],
      strengths: ['你开始愿意把信息发出来，而不是只在心里判断。'],
      nextActions: ['列 3 个 AI 相关案例标题。'],
      questions: ['这周我真正想争取的位置是什么？'],
      source: 'review-file',
    }],
  });

  const target = {
    dataset: { action: 'select-review', id: 'week-2026-06-22' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /这一周的主线是工作去向和表达边界。/);
  assert.match(app.innerHTML, /职业去向的焦虑已经落在具体问题上。/);
  assert.match(app.innerHTML, /可能没看见的地方/);
  assert.match(app.innerHTML, /你可能把“没准备好”和“不值得开始”混在了一起。/);
  assert.match(app.innerHTML, /隐藏优点/);
  assert.match(app.innerHTML, /你开始愿意把信息发出来/);
  assert.match(app.innerHTML, /列 3 个 AI 相关案例标题。/);
  assert.match(app.innerHTML, /可以问自己的问题/);
  assert.match(app.innerHTML, /这周我真正想争取的位置是什么？/);
  assert.doesNotMatch(app.innerHTML, /本周共记录 1 天。/);
});

test('right panel uses manual comments and private notes instead of model chat', async () => {
  const { app, listeners } = await mountApp(entries);

  assert.match(app.innerHTML, />评论 <span>1 条<\/span>/);
  assert.match(app.innerHTML, /这里需要之后回看。/);
  assert.match(app.innerHTML, /data-action="resolve-comment" data-id="comment-1"[^>]*>解决<\/button>/);
  assert.match(app.innerHTML, /随便聊几句/);
  assert.match(app.innerHTML, /data-side-notes/);
  assert.doesNotMatch(app.innerHTML, /data-action="send-chat"/);
  assert.doesNotMatch(app.innerHTML, /data-action="analyze"/);

  const target = {
    dataset: { action: 'resolve-comment', id: 'comment-1' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };

  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  await new Promise((resolveTick) => setTimeout(resolveTick, 10));
  assert.doesNotMatch(app.innerHTML, /这里需要之后回看。/);

  listeners.input({
    target: {
      dataset: { sideNotes: '' },
      value: '新的旁注',
    },
  });
  await new Promise((resolveTick) => setTimeout(resolveTick, 10));

  assert.match(app.innerHTML, /新的旁注/);
});

test('sidebar entry delete menu closes when the pointer leaves that entry row', async () => {
  const { listeners } = await mountApp(entries);
  const menu = {
    open: true,
    classList: {
      remove(name) {
        menu.removedClass = name;
      },
    },
  };
  const row = {
    contains(node) {
      return node === row || node === menu;
    },
    querySelector(selector) {
      return selector === '.entry-menu[open]' ? menu : null;
    },
  };
  const target = {
    closest(selector) {
      return selector === '.day-row' ? row : null;
    },
  };

  listeners.mouseout({
    target,
    relatedTarget: { outside: true },
  });

  assert.equal(menu.open, false);
  assert.equal(menu.removedClass, 'visible');
});

test('entry page removes static notebook copy and renders a compact today status area', async () => {
  const { app, listeners } = await mountApp([{
    ...entries[0],
    prompts: {
      ...entries[0].prompts,
      mood: ['焦虑'],
      metrics: { weight: '57', sleep: '6.5', phone: '4.2' },
      exercises: { hip: { 'pelvic-tilt': true } },
      todos: [{ id: 'todo-one', text: '写一点', done: false }],
    },
  }]);

  assert.doesNotMatch(app.innerHTML, /<strong>我的日记本<\/strong>/);
  assert.match(app.innerHTML, /data-action="open-cover"[\s\S]*回到日记本/);
  assert.match(app.innerHTML, /今天留一点状态/);
  assert.match(app.innerHTML, /class="status-summary"[\s\S]*#焦虑[\s\S]*睡眠 6.5h[\s\S]*手机 4.2h[\s\S]*锻炼 1\/5/);
  assert.match(app.innerHTML, /class="mood-status-line"/);
  assert.match(app.innerHTML, /data-action="toggle-mood-picker"[\s\S]*选择/);
  assert.doesNotMatch(app.innerHTML, /<summary>[\s\S]*情绪[\s\S]*<\/summary>[\s\S]*<span>情绪<\/span>/);

  const pickerTarget = {
    dataset: { action: 'toggle-mood-picker' },
    closest(selector) {
      return selector === '[data-action]' ? pickerTarget : null;
    },
  };
  listeners.click({
    target: pickerTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /class="mood-picker"/);

  const moodTarget = {
    dataset: { action: 'toggle-mood', mood: '平静' },
    closest(selector) {
      return selector === '[data-action]' ? moodTarget : null;
    },
  };
  listeners.click({
    target: moodTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /class="mood-picker"/);
  assert.match(app.innerHTML, /#平静/);
});

test('visual tokens use warm paper, sea-salt glass, and a calmer type scale', () => {
  const css = readFileSync(resolve('src/styles.css'), 'utf8');

  assert.match(css, /--paper:\s*#fbf6ec/);
  assert.match(css, /--wash:\s*linear-gradient\(180deg,\s*#fbf6ec/);
  assert.match(css, /--sea-salt:\s*#d7e6e4/);
  assert.match(css, /--apricot:\s*#f1d4b4/);
  assert.match(css, /--fs-hero:\s*28px/);
  assert.match(css, /--fs-body:\s*16px/);
  assert.match(css, /--fs-ui:\s*13px/);
  assert.match(css, /grid-template-columns:\s*340px minmax\(640px,\s*1fr\) 320px/);
  assert.match(css, /\.journal\.cover-mode/);
  assert.match(css, /\.month-shelf-row/);
  assert.match(css, /\.page-strip/);
  assert.match(css, /\.chip\.stuck/);
  assert.match(css, /\.chip\.relational/);
  assert.match(css, /\.chip\.pressure/);
  assert.match(css, /\.mood-picker/);
  assert.match(css, /backdrop-filter:\s*blur\(22px\)/);
});

test('cover entrance shows month notebook shelves and long-range analysis', async () => {
  const { app, listeners } = await mountApp([
    {
      ...entries[0],
      id: '2026-07-02',
      firstRecordedAt: '2026-07-02T01:31:00.000Z',
      body: '好久没有写日记了，最近有点焦虑。',
      prompts: {
        ...entries[0].prompts,
        mood: ['焦虑'],
        metrics: { sleep: '6.2', phone: '5.4' },
      },
    },
    {
      ...entries[0],
      id: '2026-06-24',
      firstRecordedAt: '2026-06-24T00:12:00.000Z',
      body: '今天有几件事我觉得要记录下。',
      prompts: {
        ...entries[0].prompts,
        mood: ['存在感', '迷茫'],
        metrics: { sleep: '7.1', phone: '4.1' },
      },
    },
  ]);

  const target = {
    dataset: { action: 'open-cover' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /class="cover-page"/);
  assert.match(app.innerHTML, /class="journal cover-mode/);
  assert.doesNotMatch(app.innerHTML, /<aside class="sidebar">/);
  assert.doesNotMatch(app.innerHTML, /<aside class="right-panel">/);
  assert.match(app.innerHTML, /记录今天/);
  assert.doesNotMatch(app.innerHTML, /data-action="quick-note"/);
  assert.doesNotMatch(app.innerHTML, /继续上一页/);
  assert.doesNotMatch(app.innerHTML, /保存在本机/);
  assert.match(app.innerHTML, /2026 年 7 月/);
  assert.match(app.innerHTML, /2026 年 6 月/);
  assert.match(app.innerHTML, /data-action="open-month" data-month="2026-06"/);
  assert.match(app.innerHTML, /class="month-shelf-row/);
  assert.match(app.innerHTML, /class="month-cover/);
  assert.match(app.innerHTML, /class="page-strip"/);
  assert.match(app.innerHTML, /data-action="select-entry" data-id="2026-06-24"/);
  assert.match(app.innerHTML, /class="page-card new-page-card"[\s\S]*写今天这一页/);
  assert.match(app.innerHTML, /长期分析/);
  assert.match(app.innerHTML, /睡眠趋势/);
  assert.match(app.innerHTML, /最近状态/);
  assert.match(app.innerHTML, /记录时间/);
});

test('cover analysis reframes pressure moods instead of featuring anxiety', async () => {
  const { app, listeners } = await mountApp([{
    ...entries[0],
    id: '2026-07-02',
    firstRecordedAt: '2026-07-02T01:31:00.000Z',
    body: '最近有点焦虑。',
    prompts: {
      ...entries[0].prompts,
      mood: ['焦虑'],
    },
  }]);

  const target = {
    dataset: { action: 'open-cover' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /最近状态/);
  assert.match(app.innerHTML, /正在调整中/);
  assert.doesNotMatch(app.innerHTML, /<strong>最近状态<\/strong><p>#焦虑<\/p>/);
  assert.doesNotMatch(app.innerHTML, /<span>#焦虑<\/span>/);
});

test('fresh app opens from a diary cover with quick paths and local status', async () => {
  const { app, listeners } = await mountApp([
    {
      ...entries[0],
      id: '2026-07-02',
      firstRecordedAt: '2026-07-02T01:31:00.000Z',
      body: '好久没有写日记了，最近有点焦虑。',
      prompts: {
        ...entries[0].prompts,
        mood: ['焦虑'],
        todos: [{ id: 'todo-cover', text: '补一下上周回顾', done: false }],
      },
    },
    {
      ...entries[0],
      id: '2026-06-24',
      firstRecordedAt: '2026-06-24T00:12:00.000Z',
      body: '今天有几件事我觉得要记录下。',
      prompts: {
        ...entries[0].prompts,
        mood: ['存在感', '迷茫'],
      },
    },
  ], { useAppDefaultView: true });

  assert.match(app.innerHTML, /class="cover-page"/);
  assert.match(app.innerHTML, /class="journal cover-mode/);
  assert.doesNotMatch(app.innerHTML, /<aside class="sidebar">/);
  assert.doesNotMatch(app.innerHTML, /<aside class="right-panel">/);
  assert.match(app.innerHTML, /data-action="start-today"[\s\S]*写今天这一页/);
  assert.doesNotMatch(app.innerHTML, /data-action="quick-note"/);
  assert.doesNotMatch(app.innerHTML, /继续上一页/);
  assert.doesNotMatch(app.innerHTML, /最近一页/);
  assert.match(app.innerHTML, /好久没有写日记了/);
  assert.match(app.innerHTML, /未完成 todo/);
  assert.match(app.innerHTML, /补一下上周回顾/);
  assert.doesNotMatch(app.innerHTML, /保存在本机/);
  assert.doesNotMatch(app.innerHTML, /这里是入口，不是任务面板/);
  assert.doesNotMatch(app.innerHTML, /不把你变成数据表/);
  assert.match(app.innerHTML, /上周回顾 · 6 月 22 日 - 6 月 28 日/);
  assert.match(app.innerHTML, /class="page-strip"/);
});

test('right panel empty state stays light and mobile switcher exposes drawers', async () => {
  const { app, listeners } = await mountApp([{
    ...entries[0],
    comments: [],
    sideNotes: '',
  }]);

  assert.match(app.innerHTML, /class="mobile-switcher"/);
  assert.match(app.innerHTML, /data-action="toggle-mobile-panel" data-panel="menu"[\s\S]*目录/);
  assert.match(app.innerHTML, /data-action="toggle-mobile-panel" data-panel="notes"[\s\S]*旁注/);
  assert.match(app.innerHTML, /<div class="journal mobile-show-main">/);
  assert.match(app.innerHTML, /<section class="comment-panel is-empty">/);
  assert.match(app.innerHTML, /<div class="panel-title">评论 <span>0 条<\/span><\/div>/);
  assert.match(app.innerHTML, /选中一句，留下一点旁注。/);
  assert.match(app.innerHTML, /placeholder="旧日记里的想法，写这里。"/);

  const target = {
    dataset: { action: 'toggle-mobile-panel', panel: 'notes' },
    closest(selector) {
      return selector === '[data-action]' ? target : null;
    },
  };
  listeners.click({
    target,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /<div class="journal mobile-show-notes">/);
});

test('entry page uses explicit notebook and more links instead of hiding navigation on the brand', async () => {
  const { app } = await mountApp(entries);

  assert.doesNotMatch(app.innerHTML, /<button class="brand" data-action="open-cover"/);
  assert.match(app.innerHTML, /class="brand"/);
  assert.match(app.innerHTML, /data-action="open-cover"[\s\S]*回到日记本/);
  assert.match(app.innerHTML, /<summary>查看更多<\/summary>/);
  assert.doesNotMatch(app.innerHTML, /<summary>更多<\/summary>/);
});

test('entry page lets diaries be flipped by previous and next entries in time order', async () => {
  const diaryEntries = [
    {
      ...entries[0],
      id: '2026-07-03',
      firstRecordedAt: '2026-07-03T22:00:00.000Z',
      body: '最新的一篇',
    },
    {
      ...entries[0],
      id: '2026-07-02',
      firstRecordedAt: '2026-07-02T22:00:00.000Z',
      body: '中间的一篇',
    },
    {
      ...entries[0],
      id: '2026-07-01',
      firstRecordedAt: '2026-07-01T22:00:00.000Z',
      body: '最早的一篇',
    },
  ];
  const { app, listeners } = await mountApp(diaryEntries);

  assert.doesNotMatch(app.innerHTML, /class="pager-button previous"/);
  assert.match(app.innerHTML, /class="pager-button next" data-action="select-entry" data-id="2026-07-02"[\s\S]*下一篇/);

  const middleTarget = {
    dataset: { action: 'select-entry', id: '2026-07-02' },
    closest(selector) {
      return selector === '[data-action]' ? middleTarget : null;
    },
  };
  listeners.click({
    target: middleTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /class="pager-button previous" data-action="select-entry" data-id="2026-07-03"[\s\S]*上一篇/);
  assert.match(app.innerHTML, /class="pager-button next" data-action="select-entry" data-id="2026-07-01"[\s\S]*下一篇/);

  const oldestTarget = {
    dataset: { action: 'select-entry', id: '2026-07-01' },
    closest(selector) {
      return selector === '[data-action]' ? oldestTarget : null;
    },
  };
  listeners.click({
    target: oldestTarget,
    preventDefault() {},
    stopPropagation() {},
  });

  assert.match(app.innerHTML, /class="pager-button previous" data-action="select-entry" data-id="2026-07-02"[\s\S]*上一篇/);
  assert.doesNotMatch(app.innerHTML, /class="pager-button next"/);
});
