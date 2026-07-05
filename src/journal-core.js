const DEFAULT_TITLE = '今天想记下什么？';

function getTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
}

export function dateKey(date = new Date(), timeZone = getTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function monthKey(date = new Date(), timeZone = getTimeZone()) {
  return dateKey(date, timeZone).slice(0, 7);
}

function timeKey(date = new Date(), timeZone = getTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.hour}${value.minute}${value.second}`;
}

function parseKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

function dayKeyFromEntryId(id = '') {
  const match = String(id).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : String(id).slice(0, 10);
}

function addDaysToKey(key, amount) {
  const { year, month, day } = parseKey(key);
  const utc = new Date(Date.UTC(year, month - 1, day + amount));
  return utc.toISOString().slice(0, 10);
}

function weekStartKey(date = new Date(), timeZone = getTimeZone()) {
  const key = dateKey(date, timeZone);
  const { year, month, day } = parseKey(key);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  return addDaysToKey(key, 1 - weekday);
}

function weekStartForKey(key) {
  const { year, month, day } = parseKey(key);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  return addDaysToKey(key, 1 - weekday);
}

function cleanText(text = '') {
  return String(text).replace(/\s+/g, ' ').trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function sentenceWith(text, words) {
  const sentences = cleanText(text).split(/[。！？!?]/).map((item) => item.trim()).filter(Boolean);
  return sentences.find((sentence) => includesAny(sentence, words)) || sentences[0] || '';
}

function stripSpeakerPrefix(text) {
  return cleanText(text).replace(/^(我|你|你的回复|Codex|Inner Notes|助手)\s*[：:]\s*/i, '');
}

function compactMeaning(text) {
  return stripSpeakerPrefix(text)
    .replace(/[，。！？!?、,.:\s]/g, '')
    .replace(/^(你好|您好|hi|hello|嗨)/i, '')
    .replace(/(这是|一个|一下|测试|日记|记录|开始)/g, '')
    .trim();
}

function isShortGreeting(text) {
  const compact = stripSpeakerPrefix(text).replace(/[，。！？!?、,.:\s]/g, '').toLowerCase();
  return ['你好', '您好', 'hi', 'hello', '嗨'].includes(compact);
}

function hasMeaningfulSignal(text) {
  const compact = compactMeaning(text);
  return compact.length >= 8 || includesAny(text, [
    '难受', '开心', '生气', '害怕', '焦虑', '紧张', '自责', '失望',
    '关系', '家人', '朋友', '伴侣', '工作', '消息', '回复', '身体',
    '累', '疲惫', '睡', '分手', '吵架', '病', '压力', '重要',
    '注意力', '边界', '选择', '机会', '目标',
  ]);
}

function entryText(entry = {}) {
  const prompts = entry.prompts || {};
  const moods = Array.isArray(prompts.mood) ? prompts.mood.join(' ') : prompts.mood || '';
  const todos = Array.isArray(prompts.todos)
    ? prompts.todos.map((todo) => todo.text || '').join(' ')
    : '';
  const tomorrow = prompts.tomorrow && typeof prompts.tomorrow === 'object'
    ? prompts.tomorrow.text || ''
    : prompts.tomorrow || '';
  return [
    entry.body || '',
    moods,
    prompts.energy || '',
    todos,
    tomorrow,
  ].join(' ');
}

function isWrittenEntry(entry = {}) {
  return hasMeaningfulSignal(entryText(entry));
}

function conversationSignature(messages = []) {
  return messages
    .map((message) => `${message.role}:${stripSpeakerPrefix(message.text)}`)
    .filter(Boolean)
    .join('|');
}

function safeDomId(value, fallback) {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

export function commentDisplayItems(comments = []) {
  return comments.map((comment, index) => {
    const id = safeDomId(comment.id, `comment-${index + 1}`);
    return {
      id,
      domId: `comment-${id}`,
      highlightId: `highlight-${id}`,
      index: index + 1,
      label: `评论 ${index + 1}`,
      kind: comment.kind || 'comment',
      anchor: comment.anchor || '',
      quote: comment.anchor || '',
      text: comment.text || '',
    };
  });
}

export function ensureEntryForDate(entries = [], now = new Date(), timeZone = getTimeZone()) {
  const id = dateKey(now, timeZone);
  const existing = entries.find((entry) => entry.id === id);

  if (existing) {
    return { entry: existing, entries };
  }

  const entry = {
    id,
    title: DEFAULT_TITLE,
    firstRecordedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    prompts: {
      mood: '',
      energy: '',
      tomorrow: '',
    },
    body: '',
    comments: [],
    chatMessages: [],
    retainedConversations: [],
  };

  return {
    entry,
    entries: [entry, ...entries].sort((a, b) => b.id.localeCompare(a.id)),
  };
}

export function createEntryForDate(entries = [], now = new Date(), timeZone = getTimeZone()) {
  const baseId = `${dateKey(now, timeZone)}-${timeKey(now, timeZone)}`;
  const existingIds = new Set(entries.map((entry) => entry.id));
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId}-${String(suffix).padStart(2, '0')}`;
    suffix += 1;
  }

  const entry = {
    id,
    title: DEFAULT_TITLE,
    firstRecordedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    prompts: {
      mood: '',
      energy: '',
      tomorrow: '',
    },
    body: '',
    bodyHtml: '',
    readResponse: null,
    comments: [],
    chatMessages: [],
    sideNotes: '',
    retainedConversations: [],
  };

  return {
    entry,
    entries: [entry, ...entries].sort((a, b) => b.id.localeCompare(a.id)),
  };
}

export function analyzeEntry(entry, history = []) {
  const body = cleanText(entry?.body);
  if (!body || !hasMeaningfulSignal(body)) return [];

  const previousText = history.map((item) => item.body || '').join(' ');
  const combined = `${body} ${previousText}`;
  const comments = [];

  if (includesAny(combined, ['消息', '回复', '未回复', '不可靠', '期待', '自责'])) {
    comments.push({
      id: 'obstacle-messages',
      kind: 'obstacle',
      anchor: sentenceWith(body, ['消息', '回复', '不可靠', '自责']),
      text: '我不打算哄你说“没关系”。这里可能真的有个障碍：消息一多，你会把别人的期待揽到自己身上，然后把回复速度当成自我价值考试。',
    });
    comments.push({
      id: 'strength-sensitivity',
      kind: 'hidden-strength',
      anchor: sentenceWith(body, ['消息', '回复', '期待']),
      text: '你对别人情绪和节奏很敏感。这现在像负担，但训练好以后，也可能是你的判断力、共情能力和关系里的可靠感。',
    });
    comments.push({
      id: 'action-batch-reply',
      kind: 'small-action',
      anchor: sentenceWith(body, ['明天', '重要', '回复']),
      text: '明天做一个小实验：先完成一件重要事，再集中回复消息。我们看这会不会降低“我不可靠”的自动反应。',
    });
    return comments;
  }

  if (includesAny(combined, ['累', '疲惫', '睡', '身体', '散步'])) {
    comments.push({
      id: 'body-signal',
      kind: 'obstacle',
      anchor: sentenceWith(body, ['累', '身体', '散步']),
      text: '这里有个身体信号值得认真看：你不是只需要更努力，可能也需要更早地恢复能量。',
    });
    comments.push({
      id: 'action-body',
      kind: 'small-action',
      anchor: sentenceWith(body, ['散步', '睡']),
      text: '明天给身体一个明确位置：散步、热水、早点睡，选一个就好。',
    });
    return comments;
  }

  return [
    {
      id: 'reflection-default',
      kind: 'question',
      anchor: sentenceWith(body, []),
      text: '我先不急着下结论。今天这段里，哪一句最像你真正想对自己说的话？',
    },
  ];
}

export function summarizeConversation(messages = []) {
  const visible = messages
    .map((message) => ({ role: message.role, text: cleanText(message.text) }))
    .filter((message) => message.text);
  const allText = visible.map((message) => message.text).join(' ');
  const firstUser = visible.find((message) => message.role === 'user')?.text || allText;
  const strippedFirstUser = stripSpeakerPrefix(firstUser);
  const lowSignalGreeting = strippedFirstUser.length <= 4 && includesAny(strippedFirstUser, ['你好', 'hi', 'Hi', 'hello', 'Hello']);
  const topic = lowSignalGreeting
    ? '一次简短问候'
    : includesAny(allText, ['消息', '回复'])
    ? '关于消息的讨论'
    : includesAny(allText, ['关系', '家人', '朋友'])
      ? '关于关系的讨论'
      : '值得留下的讨论';

  const insight = lowSignalGreeting
    ? '这段讨论内容还太短，先作为开始记录保留，不急着提炼模式。'
    : includesAny(allText, ['可靠', '回复', '消息'])
    ? '这段讨论保留了一个线索：你看到消息会紧张，可能是因为你把回复速度和“我是否可靠”连在了一起。'
    : `这段讨论保留了一个线索：${firstUser.slice(0, 80)}`;

  return {
    id: `conversation-${Date.now()}`,
    title: topic,
    summary: insight,
    signature: conversationSignature(visible),
    messages: visible,
    createdAt: new Date().toISOString(),
  };
}

function composeCompanionReply({ reaction, thinking, conclusion }) {
  return {
    mode: 'structured',
    reaction,
    thinking,
    conclusion,
    text: [
      `反应：${reaction}`,
      `我在想：${thinking}`,
      `结论：${conclusion}`,
    ].join('\n\n'),
  };
}

export function buildCompanionReply(input = '', entry = {}) {
  const text = cleanText(input);
  const context = `${text} ${entry?.body || ''}`;

  if (isShortGreeting(text) || text.length <= 6) {
    return {
      mode: 'plain',
      text: isShortGreeting(text) ? '你好，我在。' : '我在。',
    };
  }

  if (includesAny(context, ['消息', '回复', '不可靠', '期待'])) {
    return composeCompanionReply({
      reaction: '我听见你不是单纯被消息打扰，而是一下子把“别人等我”扛到了自己身上。',
      thinking: '这里的关键可能不是回复速度，而是你把回复速度和“我是否可靠”连在一起了。这个连接一出现，你就很难轻松处理消息。',
      conclusion: '先不要立刻证明自己。明天试一个小实验：先完成一件重要的事，再集中回复消息；我们看焦虑有没有下降。',
    });
  }

  if (includesAny(context, ['累', '疲惫', '身体', '睡', '散步'])) {
    return composeCompanionReply({
      reaction: '我先站在你身体这边。你说的累，我不想把它翻译成意志力不够。',
      thinking: '如果恢复总是排在最后，你就会把所有事情都靠硬撑完成；这样短期有效，长期会让你更难靠近自己。',
      conclusion: '今天给身体一个明确动作：散步、热水、早点睡，三选一就够。',
    });
  }

  if (includesAny(context, ['障碍', '优点', '隐藏优点', '模式'])) {
    return composeCompanionReply({
      reaction: '可以，我在。我们不用急着给你贴标签，先把这段话拆开看。',
      thinking: '我会同时看两条线：哪一处在阻碍你，哪一处其实是能力但还没被训练好。',
      conclusion: '你可以继续发一段具体事件。我会分别指出一个障碍、一个隐藏优点、一个明天能试的小动作。',
    });
  }

  return composeCompanionReply({
    reaction: '我先陪你把这段看清楚，不急着安慰，也不急着下结论。',
    thinking: '我能感觉到这里有东西还没展开。与其替你定义它，我更想先帮你把它说得具体一点。',
    conclusion: '你可以接着说：这件事里最让我卡住的是____。如果你愿意，我再陪你一起看。',
  });
}

function isModelSetupMessage(message) {
  return message?.source === 'system' || includesAny(cleanText(message?.text), [
    'OPENAI_API_KEY',
    'OPENROUTER_API_KEY',
    '模型还没接上',
    '模型未配置',
    'Model failed',
  ]);
}

export function shouldRetainConversation(messages = []) {
  const visible = messages
    .map((message) => ({ role: message.role, text: cleanText(message.text), source: message.source }))
    .filter((message) => message.text && !isModelSetupMessage(message));
  const userText = visible
    .filter((message) => message.role === 'user')
    .map((message) => message.text)
    .join(' ');
  const assistantText = visible
    .filter((message) => message.role === 'assistant')
    .map((message) => message.text)
    .join(' ');

  return hasMeaningfulSignal(userText) && assistantText.length > 0;
}

export function retainConversation(existing = [], messages = [], now = new Date()) {
  if (!shouldRetainConversation(messages)) return existing;

  const memory = {
    ...summarizeConversation(messages),
    createdAt: now.toISOString(),
  };

  if (!memory.messages.length) return existing;

  const alreadySaved = existing.some((item) => (
    item.signature && item.signature === memory.signature
  ) || conversationSignature(item.messages || []) === memory.signature);

  if (alreadySaved) return existing;

  return [memory, ...existing];
}

export function dedupeRetainedConversations(retained = []) {
  const seen = new Set();
  return retained.map((item) => {
    if (!item.messages?.length) return item;
    const refreshed = summarizeConversation(item.messages);
    return {
      ...item,
      title: refreshed.title,
      summary: refreshed.summary,
      signature: refreshed.signature,
    };
  }).filter((item) => {
    if (item.messages?.length && !shouldRetainConversation(item.messages)) return false;
    const signature = item.signature || conversationSignature(item.messages || []);
    if (!signature) return true;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function deleteEntryById(entries = [], id = '') {
  return entries.filter((entry) => entry.id !== id);
}

export function deleteCommentById(entry = {}, id = '') {
  return {
    ...entry,
    comments: (entry.comments || []).filter((comment) => comment.id !== id),
  };
}

export function deleteRetainedConversationById(entry = {}, id = '') {
  return {
    ...entry,
    retainedConversations: (entry.retainedConversations || []).filter((item) => item.id !== id),
  };
}

export function retainedConversationPreview(memory, maxLines = 6) {
  const messages = (memory?.messages || []).slice(0, maxLines);
  return {
    title: memory?.title || '留存的讨论',
    summary: memory?.summary || '',
    hasMore: (memory?.messages || []).length > maxLines,
    lines: messages.map((message) => ({
      speaker: message.role === 'user' ? '我' : '你的回复',
      text: stripSpeakerPrefix(message.text),
    })).filter((line) => line.text),
  };
}

export function generateWeeklySummary(entries = [], now = new Date(), timeZone = getTimeZone()) {
  const start = weekStartKey(now, timeZone);
  const end = addDaysToKey(start, 6);
  const inWeek = entries
    .filter((entry) => {
      const day = dayKeyFromEntryId(entry.id);
      return day >= start && day <= end;
    })
    .filter(isWrittenEntry)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!inWeek.length) return null;

  const text = inWeek.map(entryText).join(' ');
  const patterns = [];
  const recovery = [];
  const strengths = [];
  const nextActions = [];

  if (includesAny(text, ['消息', '回复', '自责', '不可靠'])) {
    patterns.push('消息和回复压力反复出现，容易触发自责或“不可靠”的解释。');
    nextActions.push('把回复集中到固定窗口，先保护一段自己的深度时间。');
  }
  if (includesAny(text, ['散步', '运动', '身体'])) {
    recovery.push('散步或身体活动对恢复状态有帮助。');
  }
  if (includesAny(text, ['敏感', '在意', '别人', '关系'])) {
    strengths.push('你对关系和他人状态的敏感度，是需要被训练而不是被否定的能力。');
  }

  return {
    id: `week-${start}`,
    type: 'week',
    range: `${start} 至 ${end}`,
    entryCount: inWeek.length,
    patterns: patterns.length ? patterns : ['本周记录还不够多，先保留观察。'],
    recovery: recovery.length ? recovery : ['还没有稳定出现的恢复方式。'],
    strengths: strengths.length ? strengths : ['隐藏优点会在更多记录后更清楚。'],
    nextActions: nextActions.length ? nextActions : ['下周先保持记录，不急着改变太多。'],
    summary: `本周共记录 ${inWeek.length} 天。`,
    createdAt: new Date().toISOString(),
  };
}

export function generateMonthlySummary(entries = [], now = new Date(), timeZone = getTimeZone()) {
  const month = monthKey(now, timeZone);
  const inMonth = entries
    .filter((entry) => entry.id.startsWith(month))
    .filter(isWrittenEntry)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!inMonth.length) return null;

  const text = inMonth.map((entry) => entry.body || '').join(' ');
  const themes = [];

  if (includesAny(text, ['消息', '回复'])) themes.push('消息边界');
  if (includesAny(text, ['散步', '身体', '睡'])) themes.push('身体恢复');
  if (includesAny(text, ['重要', '效率', '完成'])) themes.push('注意力保护');

  return {
    id: `month-${month}`,
    type: 'month',
    month,
    entryCount: inMonth.length,
    themes: themes.length ? themes : ['继续观察'],
    summary: `这个月已经记录 ${inMonth.length} 天。${themes.length ? `目前最明显的主题是：${themes.join('、')}。` : '等记录多一点后，我会帮你提炼更稳定的主题。'}`,
    createdAt: new Date().toISOString(),
  };
}

function sortSummaries(summaries = []) {
  return [...summaries].sort((a, b) => {
    const aKey = a.type === 'month' ? `${a.month}-99` : a.id.replace('week-', '');
    const bKey = b.type === 'month' ? `${b.month}-99` : b.id.replace('week-', '');
    return bKey.localeCompare(aKey);
  });
}

function generateWeeklySummaryForStart(entries = [], start = '') {
  const { year, month, day } = parseKey(start);
  return generateWeeklySummary(entries, new Date(Date.UTC(year, month - 1, day, 12)));
}

function generateMonthlySummaryForMonth(entries = [], month = '') {
  const [year, value] = month.split('-').map(Number);
  return generateMonthlySummary(entries, new Date(Date.UTC(year, value - 1, 15, 12)));
}

export function generateAutomaticSummaries(entries = [], existing = [], now = new Date(), timeZone = getTimeZone()) {
  return sortSummaries(existing.filter((summary) => !summary.autoGenerated));
}

function promptLine(label, value) {
  if (Array.isArray(value)) return `- ${label}: ${value.length ? value.join('、') : '未填写'}`;
  if (value && typeof value === 'object') return `- ${label}: ${value.text || '未填写'}${value.done ? '（已完成）' : ''}`;
  return `- ${label}: ${value || '未填写'}`;
}

function metricsLine(metrics = {}) {
  const parts = [
    metrics.weight ? `体重 ${metrics.weight}kg` : '',
    metrics.sleep ? `睡眠 ${metrics.sleep}小时` : '',
    metrics.phone ? `手机 ${metrics.phone}小时` : '',
  ].filter(Boolean);
  return `- 身体和习惯: ${parts.length ? parts.join('，') : '未填写'}`;
}

function todosLine(prompts = {}) {
  const todos = Array.isArray(prompts.todos)
    ? prompts.todos
    : String(prompts.tomorrow?.text || prompts.tomorrow || '')
      .split('\n')
      .filter(Boolean)
      .map((text) => ({ text, done: Boolean(prompts.tomorrow?.done) }));
  const visible = todos.filter((todo) => todo.text || todo.done);
  if (!visible.length) return '- 今日 todo: 未填写';
  return [
    '- 今日 todo:',
    ...visible.map((todo) => `  - ${todo.done ? '[x]' : '[ ]'} ${todo.text || ''}`),
  ].join('\n');
}

function entryMarkdown(entry) {
  const prompts = entry.prompts || {};
  const comments = entry.comments || [];
  const readResponse = entry.readResponse;
  const retained = entry.retainedConversations || [];
  const sideNotes = String(entry.sideNotes || '').trim();

  return [
    `# ${entry.id} ${entry.title || DEFAULT_TITLE}`,
    '',
    `首次记录: ${entry.firstRecordedAt || ''}`,
    `最后更新: ${entry.updatedAt || ''}`,
    '',
    '## 轻提示',
    promptLine('情绪', prompts.mood),
    promptLine('能量', prompts.energy),
    metricsLine(prompts.metrics),
    todosLine(prompts),
    '',
    '## 正文',
    entry.body || '',
    '',
    '## 评论',
    comments.length
      ? comments.map((comment, index) => [
        `### 评论 ${index + 1}`,
        comment.quote ? `> ${comment.quote}` : '',
        comment.text,
      ].filter(Boolean).join('\n\n')).join('\n\n')
      : '暂无',
    '',
    '## 随便聊几句',
    sideNotes || '暂无',
    '',
    '## 读后回应',
    readResponse?.response
      ? [
        readResponse.quote ? `> ${readResponse.quote}` : '',
        readResponse.response,
        readResponse.question ? `\n问题: ${readResponse.question}` : '',
        readResponse.details?.length ? `\n再细看一点:\n${readResponse.details.map((item) => `- ${item}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n')
      : '暂无',
    '',
    '## 留存对话',
    retained.length ? retained.map((item) => {
      const preview = retainedConversationPreview(item);
      return [
        `### ${preview.title}`,
        `总结: ${preview.summary}`,
        '',
        preview.lines.map((line) => `- ${line.speaker}: ${line.text}`).join('\n'),
        preview.hasMore ? '- ...' : '',
      ].filter(Boolean).join('\n');
    }).join('\n\n') : '暂无',
    '',
  ].join('\n');
}

function sanitizeEntryForBackup(entry) {
  return {
    ...entry,
    comments: (entry.comments || []).map(({ role, ...comment }) => comment),
  };
}

export function buildBackupDocuments(state = {}) {
  const entries = state.entries || [];
  const summaries = state.summaries || [];

  return {
    daily: entries.map((entry) => {
      const cleanEntry = sanitizeEntryForBackup(entry);
      return {
        id: cleanEntry.id,
        markdown: entryMarkdown(cleanEntry),
        json: JSON.stringify(cleanEntry, null, 2),
      };
    }),
    summaries: summaries.map((summary) => ({
      id: summary.id,
      type: summary.type,
      markdown: [
        `# ${summary.id}`,
        '',
        summary.summary || '',
        '',
        summary.patterns ? `## 模式\n${summary.patterns.map((item) => `- ${item}`).join('\n')}` : '',
        summary.recovery ? `## 恢复方式\n${summary.recovery.map((item) => `- ${item}`).join('\n')}` : '',
        summary.nextActions ? `## 下一步\n${summary.nextActions.map((item) => `- ${item}`).join('\n')}` : '',
      ].filter(Boolean).join('\n'),
      json: JSON.stringify(summary, null, 2),
    })),
  };
}
