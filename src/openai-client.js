function cleanText(value = '') {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function composeStructuredText({ reaction, thinking, conclusion }) {
  return [
    `反应：${reaction}`,
    `我在想：${thinking}`,
    `结论：${conclusion}`,
  ].join('\n\n');
}

function safeKind(kind = '') {
  return ['obstacle', 'hidden-strength', 'small-action', 'question'].includes(kind)
    ? kind
    : 'question';
}

export function validateApiKey(name, value, { prefix = '' } = {}) {
  const key = String(value || '').trim();
  if (!key) throw new Error(`${name} is not set.`);
  if (/你的|your|placeholder|新key/i.test(key)) {
    throw new Error(`${name} contains placeholder text. Replace it with the real secret key from the provider dashboard.`);
  }
  if (/[^\x00-\x7F]/.test(key)) {
    throw new Error(`${name} contains non-ASCII characters. Paste the real key only; do not include Chinese placeholder text.`);
  }
  if (prefix && !key.startsWith(prefix)) {
    throw new Error(`${name} should start with ${prefix}.`);
  }
  return key;
}

export function buildJsonResponseRequest({
  model,
  instructions,
  payload,
  schemaName,
  schema,
}) {
  return {
    model,
    instructions,
    input: JSON.stringify(payload),
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        strict: true,
        schema,
      },
    },
  };
}

export function buildOpenRouterChatRequest({
  model,
  instructions,
  payload,
  schemaName,
  schema,
}) {
  return {
    model,
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: schemaName,
        strict: true,
        schema,
      },
    },
  };
}

export function extractResponseText(response = {}) {
  if (typeof response.output_text === 'string') return response.output_text;

  const content = response.output
    ?.flatMap((item) => item.content || [])
    ?.find((item) => typeof item.text === 'string');

  return content?.text || '';
}

export function extractChatCompletionText(response = {}) {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find((item) => typeof item.text === 'string');
    return textPart?.text || '';
  }
  return '';
}

export function parseModelJson(text = '') {
  const raw = cleanText(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Model did not return valid JSON: ${error.message}`);
  }
}

export function normalizeModelReply(raw = {}) {
  const mode = raw.mode === 'plain' ? 'plain' : 'structured';

  if (mode === 'plain') {
    return {
      mode,
      text: cleanText(raw.text) || '我在。',
    };
  }

  const reaction = cleanText(raw.reaction) || '我听见了。';
  const thinking = cleanText(raw.thinking) || '这里我先不急着替你下结论。';
  const conclusion = cleanText(raw.conclusion) || '你可以再补一小段具体事实，我再接着看。';

  return {
    mode,
    reaction,
    thinking,
    conclusion,
    text: cleanText(raw.text) || composeStructuredText({ reaction, thinking, conclusion }),
  };
}

export function normalizeModelComments(raw = {}, body = '') {
  const text = cleanText(body);
  const comments = Array.isArray(raw.comments) ? raw.comments : [];

  return comments
    .map((comment, index) => ({
      id: cleanText(comment.id) || `model-comment-${index + 1}`,
      kind: safeKind(comment.kind),
      anchor: cleanText(comment.anchor),
      text: cleanText(comment.text),
    }))
    .filter((comment) => comment.anchor && comment.text && text.includes(comment.anchor))
    .map((comment, index) => ({
      ...comment,
      id: comment.id.startsWith('model-comment-') ? `model-comment-${index + 1}` : comment.id,
    }));
}

export function normalizeModelReadResponse(raw = {}, body = '') {
  const text = cleanText(body);
  const quote = cleanText(raw.quote);
  const safeQuote = quote && text.includes(quote) ? quote : null;
  const details = Array.isArray(raw.details)
    ? raw.details.map(cleanText).filter(Boolean).slice(0, 3)
    : [];

  return {
    response: cleanText(raw.response || raw.text),
    quote: safeQuote,
    question: cleanText(raw.question) || null,
    details,
  };
}
