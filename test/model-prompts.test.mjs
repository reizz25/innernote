import test from 'node:test';
import assert from 'node:assert/strict';

import { chatInstructions, readResponseInstructions } from '../src/model-prompts.js';

test('chat prompt defines the intended companion persona without forcing consulting mode', () => {
  assert.match(chatInstructions, /有点幽默/);
  assert.match(chatInstructions, /冷静/);
  assert.match(chatInstructions, /真挚/);
  assert.match(chatInstructions, /关心/);
  assert.match(chatInstructions, /自我欺瞒|自欺/);
  assert.match(chatInstructions, /没意识到的问题|机会/);
  assert.match(chatInstructions, /短问候就短回/);
  assert.doesNotMatch(chatInstructions, /灌鸡汤/);
});

test('read response prompt uses the companion persona without becoming a comment report', () => {
  assert.match(readResponseInstructions, /有点幽默/);
  assert.match(readResponseInstructions, /冷静/);
  assert.match(readResponseInstructions, /真挚/);
  assert.match(readResponseInstructions, /80-120 字/);
  assert.match(readResponseInstructions, /再细看一点/);
  assert.match(readResponseInstructions, /不要审判/);
  assert.doesNotMatch(readResponseInstructions, /最多 3 条/);
  assert.doesNotMatch(readResponseInstructions, /批注/);
});
