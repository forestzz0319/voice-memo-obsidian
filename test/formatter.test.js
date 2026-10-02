import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFormatter } from '../formatter.js';

// --- SDK の代わりになる最小限の偽物 ---
class APIError extends Error {
  constructor(status, message = 'err') { super(message); this.status = status; }
}
class AuthenticationError extends APIError {}
class RateLimitError extends APIError {}

function makeFakeAnthropic(script) {
  const calls = [];
  class FakeAnthropic {
    constructor(opts) { this.opts = opts; }
    get beta() {
      return {
        messages: {
          stream: (params, reqOpts) => {
            const call = { params, signal: reqOpts?.signal, client: this.opts };
            calls.push(call);
            return script(call);
          },
        },
      };
    }
  }
  FakeAnthropic.APIError = APIError;
  FakeAnthropic.AuthenticationError = AuthenticationError;
  FakeAnthropic.RateLimitError = RateLimitError;
  return { FakeAnthropic, calls };
}

function textStream(chunks, { stopReason = 'end_turn', events = null } = {}) {
  const evs = events ?? chunks.map((t) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } }));
  return {
    async *[Symbol.asyncIterator]() { for (const e of evs) yield e; },
    finalMessage: async () => ({ stop_reason: stopReason }),
  };
}

const settings = { apiKey: 'k', model: 'claude-opus-5-5', dictionary: 'a → b', tagCandidates: '肩, 膝' };
const tick = () => new Promise((r) => setTimeout(r, 0));

function manualTimers() {
  let pending = null;
  return {
    setTimer: (fn) => { pending = fn; return 1; },
    clearTimer: () => { pending = null; },
    fire: () => { const f = pending; pending = null; f?.(); },
    get pending() { return pending; },
  };
}

test('runNow: 累積テキストをonDeltaに渡し、完了でonDone', async () => {
  const { FakeAnthropic, calls } = makeFakeAnthropic(() => textStream(['TITLE: t\n', 'TAGS: a\n---\n', '本文']));
  const deltas = [];
  let done = null;
  const f = createFormatter({
    Anthropic: FakeAnthropic,
    getSettings: () => settings,
    onDelta: (t) => deltas.push(t),
    onDone: (t) => { done = t; },
    onError: (m) => assert.fail(m),
  });
  await f.runNow('えーと原文');
  assert.equal(deltas.at(-1), 'TITLE: t\nTAGS: a\n---\n本文');
  assert.equal(done, 'TITLE: t\nTAGS: a\n---\n本文');

  const p = calls[0].params;
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.output_config.effort, 'low');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.messages, [{ role: 'user', content: 'えーと原文' }]);
  assert.match(p.system, /a → b/);
  assert.match(p.system, /タグ候補: 肩, 膝/);
  assert.equal(calls[0].client.apiKey, 'k');
  assert.equal(calls[0].client.dangerouslyAllowBrowser, true);
});

test('schedule: デバウンスされ、最後の原文だけ送る', async () => {
  const timers = manualTimers();
  const { FakeAnthropic, calls } = makeFakeAnthropic(() => textStream(['x']));
  const f = createFormatter({
    Anthropic: FakeAnthropic, getSettings: () => settings,
    onDelta() {}, onDone() {}, onError: (m) => assert.fail(m),
    setTimer: timers.setTimer, clearTimer: timers.clearTimer,
  });
  f.schedule('一');
  f.schedule('一二');
  assert.equal(calls.length, 0);
  timers.fire();
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.messages[0].content, '一二');
});

test('新しい実行が来たら前の実行を中断し、中断はエラー扱いしない', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let n = 0;
  const { FakeAnthropic, calls } = makeFakeAnthropic((call) => {
    n++;
    if (n === 1) {
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '古い' } };
          await gate;
          if (call.signal.aborted) throw new Error('aborted');
        },
        finalMessage: async () => ({ stop_reason: 'end_turn' }),
      };
    }
    return textStream(['新しい']);
  });
  const deltas = [];
  const errors = [];
  const f = createFormatter({
    Anthropic: FakeAnthropic, getSettings: () => settings,
    onDelta: (t) => deltas.push(t), onDone() {}, onError: (m) => errors.push(m),
  });
  const first = f.runNow('1');
  await tick();
  const second = f.runNow('12');
  assert.equal(calls[0].signal.aborted, true);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(errors, []);
  assert.equal(deltas.at(-1), '新しい');
});

test('fallbackブロックが来たら途中テキストを捨てて振り替え先の出力を表示する', async () => {
  const events = [
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '途中' } },
    { type: 'content_block_start', content_block: { type: 'fallback' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '振替後' } },
  ];
  const { FakeAnthropic } = makeFakeAnthropic(() => textStream(null, { events }));
  let done = null;
  const f = createFormatter({
    Anthropic: FakeAnthropic, getSettings: () => settings,
    onDelta() {}, onDone: (t) => { done = t; }, onError: (m) => assert.fail(m),
  });
  await f.runNow('x');
  assert.equal(done, '振替後');
});

test('refusalはエラーとして通知する', async () => {
  const { FakeAnthropic } = makeFakeAnthropic(() => textStream([], { stopReason: 'refusal' }));
  const errors = [];
  const f = createFormatter({
    Anthropic: FakeAnthropic, getSettings: () => settings,
    onDelta() {}, onDone: () => assert.fail('done'), onError: (m) => errors.push(m),
  });
  await f.runNow('x');
  assert.equal(errors.length, 1);
});

test('APIキー未設定・原文が空なら呼び出さない', async () => {
  const { FakeAnthropic, calls } = makeFakeAnthropic(() => textStream(['x']));
  const errors = [];
  const f = createFormatter({
    Anthropic: FakeAnthropic, getSettings: () => ({ ...settings, apiKey: '' }),
    onDelta() {}, onDone() {}, onError: (m) => errors.push(m),
  });
  await f.runNow('x');
  assert.equal(calls.length, 0);
  assert.match(errors[0], /APIキー/);
  errors.length = 0;
  const g = createFormatter({
    Anthropic: FakeAnthropic, getSettings: () => settings,
    onDelta() {}, onDone() {}, onError: (m) => errors.push(m),
  });
  await g.runNow('   ');
  assert.equal(calls.length, 0);
  assert.equal(errors.length, 0);
});

test('エラーの種類ごとにメッセージを分ける', async () => {
  for (const [err, re] of [
    [new AuthenticationError(401), /APIキー/],
    [new RateLimitError(429), /混雑|上限/],
    [new APIError(500), /500/],
    [new TypeError('Failed to fetch'), /通信/],
  ]) {
    const { FakeAnthropic } = makeFakeAnthropic(() => ({
      async *[Symbol.asyncIterator]() { throw err; },
      finalMessage: async () => { throw err; },
    }));
    const errors = [];
    const f = createFormatter({
      Anthropic: FakeAnthropic, getSettings: () => settings,
      onDelta() {}, onDone() {}, onError: (m) => errors.push(m),
    });
    await f.runNow('x');
    assert.match(errors[0], re);
  }
});
