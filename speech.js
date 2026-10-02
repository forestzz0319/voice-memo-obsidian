// Chrome 内蔵の音声認識（Web Speech API）のラッパー。
// Chrome は少し黙ると認識を勝手に終了するので、利用者が止めるか最大時間に
// 達するまでは自動で再開し、1回の録音として扱う。

const DEFAULT_MAX_MS = 3 * 60 * 1000;
const RESTART_DELAY_MS = 250;
const TICK_MS = 1000;
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/**
 * @param {{
 *   onInterim: (text: string) => void,  // 確定前の途中結果（今の発話分のみ）
 *   onFinal: (text: string) => void,    // 確定した1区切り
 *   onStateChange: (listening: boolean) => void,
 *   onError: (message: string) => void,
 *   onTick?: (elapsedMs: number) => void,  // 録音中、1秒ごとに経過時間
 *   maxDurationMs?: number,
 *   Impl?: any, now?: () => number, setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout,
 * }} opts
 */
export function createRecognizer(opts) {
  const {
    onInterim, onFinal, onStateChange, onError,
    onTick = () => {},
    maxDurationMs = DEFAULT_MAX_MS,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = opts;
  const Impl = 'Impl' in opts
    ? opts.Impl
    : (globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition);
  if (!Impl) {
    return { isSupported: false, start() {}, stop() {}, get listening() { return false; } };
  }

  let rec = null;
  let listening = false; // 利用者から見た録音中かどうか（自動再開の合間も true）
  let wanted = false; // 利用者が録音を続けたいか（stop() か最大時間で false）
  let startedAt = 0;
  let pendingInterim = '';
  let fatal = false;
  let tickTimer = null;
  let restartTimer = null;

  function setListening(v) {
    if (listening === v) return;
    listening = v;
    onStateChange(v);
  }

  function flushInterim() {
    const t = pendingInterim.trim();
    pendingInterim = '';
    onInterim('');
    if (t) onFinal(t);
  }

  function elapsed() {
    return now() - startedAt;
  }

  function tick() {
    const ms = Math.min(elapsed(), maxDurationMs);
    onTick(Math.floor(ms / TICK_MS) * TICK_MS);
    if (ms >= maxDurationMs) {
      stop();
      return;
    }
    tickTimer = setTimer(tick, TICK_MS - (ms % TICK_MS));
  }

  function finish() {
    if (tickTimer !== null) clearTimer(tickTimer);
    if (restartTimer !== null) clearTimer(restartTimer);
    tickTimer = restartTimer = null;
    rec = null;
    wanted = false;
    setListening(false);
  }

  function spawn() {
    const r = new Impl();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) {
          if (t.trim()) onFinal(t.trim());
        } else {
          interim += t;
        }
      }
      pendingInterim = interim;
      onInterim(interim);
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (FATAL_ERRORS.has(e.error)) fatal = true;
      const messages = {
        'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください。',
        'service-not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください。',
        'audio-capture': 'マイクが見つかりません。',
        network: '音声認識に必要な通信ができませんでした。',
      };
      onError(messages[e.error] ?? `音声認識エラー: ${e.error}`);
    };
    r.onend = () => {
      if (rec !== r) return; // 古いインスタンスの終了通知は無視
      flushInterim();
      if (wanted && !fatal && elapsed() < maxDurationMs) {
        restartTimer = setTimer(() => {
          restartTimer = null;
          if (wanted) spawn();
        }, RESTART_DELAY_MS);
      } else {
        finish();
      }
    };

    rec = r;
    try {
      r.start();
    } catch (err) {
      onError(`音声認識を開始できませんでした: ${err.message}`);
      finish();
    }
  }

  function start() {
    if (listening) return;
    fatal = false;
    pendingInterim = '';
    startedAt = now();
    wanted = true;
    setListening(true);
    onTick(0);
    tickTimer = setTimer(tick, TICK_MS);
    spawn();
  }

  function stop() {
    if (!listening) return;
    wanted = false;
    // 先に rec を外しておくと、このあと届く onend は「古いインスタンス」として無視される。
    const r = rec;
    rec = null;
    r?.stop();
    flushInterim();
    finish();
  }

  return {
    isSupported: true,
    start,
    stop,
    get listening() { return listening; },
  };
}
