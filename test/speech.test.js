import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecognizer } from '../speech.js';

// Web Speech API の偽物。インスタンスを記録し、テストから結果や終了を発火できる。
function fakeImpl() {
  const instances = [];
  class FakeRecognition {
    constructor() { instances.push(this); this.started = false; this.stopped = false; }
    start() { this.started = true; }
    stop() { this.stopped = true; this.onend?.(); }
    result(text, isFinal) {
      const r = [{ transcript: text }];
      r.isFinal = isFinal;
      this.onresult?.({ resultIndex: 0, results: [r] });
    }
    end() { this.onend?.(); }
    error(code) { this.onerror?.({ error: code }); }
  }
  return { FakeRecognition, instances };
}

function fakeClock() {
  let t = 0;
  const timers = [];
  return {
    now: () => t,
    setTimer: (fn, ms) => { const h = { fn, at: t + ms }; timers.push(h); return h; },
    clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = timers.filter((h) => h.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        t = Math.max(t, due.at);
        due.fn();
      }
      t = end;
    },
  };
}

function setup(extra = {}) {
  const { FakeRecognition, instances } = fakeImpl();
  const clock = fakeClock();
  const log = { finals: [], states: [], errors: [], ticks: [] };
  const r = createRecognizer({
    Impl: FakeRecognition,
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    onInterim() {},
    onFinal: (t) => log.finals.push(t),
    onStateChange: (v) => log.states.push(v),
    onError: (m) => log.errors.push(m),
    onTick: (ms) => log.ticks.push(ms),
    ...extra,
  });
  return { r, instances, clock, log };
}

test('無音で認識が終わっても、停止するまで自動で再開する', () => {
  const { r, instances, clock, log } = setup();
  r.start();
  assert.equal(instances.length, 1);
  instances[0].result('一文目', true);
  instances[0].end(); // Chrome が無音で勝手に終了
  clock.advance(300);
  assert.equal(instances.length, 2);
  assert.equal(instances[1].started, true);
  assert.equal(r.listening, true);
  assert.deepEqual(log.states, [true]); // 途中で false にならない
  instances[1].result('二文目', true);
  assert.deepEqual(log.finals, ['一文目', '二文目']);
});

test('stop() で終了し、再開しない', () => {
  const { r, instances, clock, log } = setup();
  r.start();
  r.stop();
  clock.advance(1000);
  assert.equal(instances.length, 1);
  assert.equal(r.listening, false);
  assert.deepEqual(log.states, [true, false]);
});

test('最大時間（既定3分）で自動停止する', () => {
  const { r, instances, clock, log } = setup();
  r.start();
  clock.advance(179_000);
  assert.equal(r.listening, true);
  clock.advance(1_000);
  assert.equal(r.listening, false);
  assert.equal(instances.at(-1).stopped, true);
  assert.ok(log.ticks.includes(180_000) || log.ticks.at(-1) >= 179_000);
});

test('最大時間は変更できる', () => {
  const { r, clock } = setup({ maxDurationMs: 5_000 });
  r.start();
  clock.advance(5_000);
  assert.equal(r.listening, false);
});

test('終了時に確定前の途中結果が残っていたら確定扱いにする', () => {
  const { r, instances, clock, log } = setup();
  r.start();
  instances[0].result('途中の言葉', false);
  instances[0].end();
  clock.advance(300);
  assert.deepEqual(log.finals, ['途中の言葉']);
});

test('マイク拒否などの致命的エラーでは再開しない', () => {
  const { r, instances, clock, log } = setup();
  r.start();
  instances[0].error('not-allowed');
  instances[0].end();
  clock.advance(1000);
  assert.equal(instances.length, 1);
  assert.equal(r.listening, false);
  assert.equal(log.errors.length, 1);
});

test('no-speech はエラー表示せず再開する', () => {
  const { r, instances, clock, log } = setup();
  r.start();
  instances[0].error('no-speech');
  instances[0].end();
  clock.advance(300);
  assert.equal(instances.length, 2);
  assert.deepEqual(log.errors, []);
});

test('経過時間を1秒ごとに通知する', () => {
  const { r, clock, log } = setup();
  r.start();
  clock.advance(3_000);
  assert.deepEqual(log.ticks.slice(0, 4), [0, 1000, 2000, 3000]);
});

test('非対応ブラウザでは isSupported: false', () => {
  const r = createRecognizer({ Impl: null, onInterim() {}, onFinal() {}, onStateChange() {}, onError() {} });
  assert.equal(r.isSupported, false);
});
