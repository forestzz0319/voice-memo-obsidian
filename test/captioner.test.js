import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCaptioner } from '../captioner.js';

class APIError extends Error { constructor(status) { super('err'); this.status = status; } }

function fakeAnthropic(reply) {
  const calls = [];
  class FakeAnthropic {
    constructor(opts) { this.opts = opts; }
    get beta() {
      return {
        messages: {
          create: async (params) => {
            calls.push({ params, client: this.opts });
            return reply(params);
          },
        },
      };
    }
  }
  FakeAnthropic.APIError = APIError;
  return { FakeAnthropic, calls };
}

const textReply = (text, stop_reason = 'end_turn') => ({ stop_reason, content: [{ type: 'text', text }] });
const settings = { apiKey: 'k', model: 'claude-opus-5-5', dictionary: 'こつそしょう → 骨粗鬆症' };

function setup(reply, s = settings) {
  const { FakeAnthropic, calls } = fakeAnthropic(reply);
  const updates = [];
  const errors = [];
  const c = createCaptioner({
    Anthropic: FakeAnthropic,
    getSettings: () => s,
    onUpdate: (id, text) => updates.push([id, text]),
    onError: (m) => errors.push(m),
  });
  return { c, calls, updates, errors };
}

test('補正結果で行を差し替える', async () => {
  const { c, calls, updates } = setup(() => textReply('これは骨粗鬆症です。'));
  const id = c.add('えーこれはこつそしょうです');
  await c.idle();
  assert.deepEqual(updates, [[id, 'これは骨粗鬆症です。']]);
  const p = calls[0].params;
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.output_config.effort, 'low');
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.match(p.system, /こつそしょう → 骨粗鬆症/);
  assert.match(p.messages[0].content, /えーこれはこつそしょうです/);
  assert.equal(calls[0].client.dangerouslyAllowBrowser, true);
});

test('直前の行（補正済みを優先）を文脈として渡す', async () => {
  const { c, calls } = setup((p) => textReply(p.messages[0].content.includes('二') ? '二。' : '一。'));
  c.add('一');
  await c.idle();
  c.add('二');
  await c.idle();
  assert.match(calls[1].params.messages[0].content, /<直前の発言（参考）>\n一。\n/);
});

test('APIエラーなら原文のまま（onUpdateしない）でエラー通知', async () => {
  const { c, updates, errors } = setup(() => { throw new APIError(500); });
  c.add('これは');
  await c.idle();
  assert.deepEqual(updates, []);
  assert.equal(errors.length, 1);
});

test('拒否・空・極端に長い出力は採用しない', async () => {
  for (const reply of [textReply('x', 'refusal'), textReply('   '), textReply('あ'.repeat(100))]) {
    const { c, updates } = setup(() => reply);
    c.add('短い文です');
    await c.idle();
    assert.deepEqual(updates, []);
  }
});

test('APIキー未設定なら呼ばずに通知', async () => {
  const { c, calls, errors } = setup(() => textReply('x'), { ...settings, apiKey: '' });
  c.add('文');
  await c.idle();
  assert.equal(calls.length, 0);
  assert.match(errors[0], /APIキー/);
});

test('手で直した行は、後から届いた補正で上書きしない', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { c, updates } = setup(async () => { await gate; return textReply('AIの補正'); });
  const id = c.add('まちがい');
  c.edit(id, '手で直した文');
  release();
  await c.idle();
  assert.deepEqual(updates, []);
});

test('手で直した文を次の文の文脈に使う', async () => {
  const { c, calls } = setup(() => textReply('補正。'));
  const id = c.add('一');
  await c.idle();
  c.edit(id, '手で直した一');
  c.add('二');
  await c.idle();
  assert.match(calls[1].params.messages[0].content, /<直前の発言（参考）>\n手で直した一\n/);
});

test('clear() 後に返ってきた結果は捨てる', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { c, updates } = setup(async () => { await gate; return textReply('遅い結果'); });
  c.add('文');
  c.clear();
  release();
  await c.idle();
  assert.deepEqual(updates, []);
});
