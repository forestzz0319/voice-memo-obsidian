// 字幕ページの画面。PCのChromeで、先生の説明を大きな字幕にする。

import { createRecognizer } from './speech.js';
import { createCaptioner } from './captioner.js';
import { MODELS, loadSettings, saveSettings } from './settings.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';
const SIZE_KEY = 'voice-memo-obsidian.captionSize';

const $ = (id) => document.getElementById(id);
const el = {
  toggle: $('btn-toggle'), clear: $('btn-clear'), status: $('status'), openSettings: $('btn-settings'),
  captions: $('captions'), interim: $('interim'), placeholder: $('placeholder'),
  dialog: $('settings'), form: $('settings-form'),
};

let settings = loadSettings();

function setStatus(text, isError = false) {
  el.status.textContent = text;
  el.status.classList.toggle('error', isError);
}

// ---------- 字幕の行 ----------

const lineEls = new Map();

function scrollToBottom() {
  el.captions.scrollTop = el.captions.scrollHeight;
}

function addLine(id, text) {
  el.placeholder.hidden = true;
  const p = document.createElement('p');
  p.className = 'line';
  p.textContent = text;
  el.captions.insertBefore(p, el.interim);
  lineEls.set(id, p);
  scrollToBottom();
}

function replaceLine(id, text) {
  const p = lineEls.get(id);
  if (!p) return;
  p.textContent = text;
  p.classList.remove('fixed');
  void p.offsetWidth; // アニメーションをやり直す
  p.classList.add('fixed');
}

// ---------- 補正 ----------

let captioner = null;
try {
  const { default: Anthropic } = await import(SDK_URL);
  captioner = createCaptioner({
    Anthropic,
    getSettings: () => settings,
    onUpdate: replaceLine,
    onError: (m) => setStatus(m, true),
  });
} catch (err) {
  setStatus(`補正の部品を読み込めませんでした（通信を確認）。字幕は補正なしで表示します。`, true);
}

let localId = 0;
function addSentence(text) {
  if (captioner) {
    const id = captioner.add(text);
    addLine(id, text);
  } else {
    addLine(`local-${++localId}`, text);
  }
}

// ---------- 音声認識 ----------

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock?.request('screen');
      wakeLock?.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // スリープ防止は必須ではないので失敗しても続ける
  }
}

const recognizer = createRecognizer({
  continuous: true,
  maxDurationMs: Infinity,
  onInterim: (t) => {
    el.interim.textContent = t;
    if (t) {
      el.placeholder.hidden = true;
      scrollToBottom();
    }
  },
  onFinal: addSentence,
  onStateChange: (listening) => {
    el.toggle.classList.toggle('on', listening);
    el.toggle.textContent = listening ? '■ 停止' : '▶ 開始';
    keepAwake(listening);
    if (listening && !el.status.classList.contains('error')) setStatus('聞き取り中');
    if (!listening && el.status.textContent === '聞き取り中') setStatus('');
  },
  onError: (m) => setStatus(m, true),
});

if (!recognizer.isSupported) {
  el.toggle.disabled = true;
  setStatus('このブラウザは音声認識に対応していません。Google Chrome で開いてください。', true);
} else if (!settings.apiKey) {
  setStatus('⚙ 設定でAPIキーを入力すると、医療用語の補正が有効になります。');
}

el.toggle.addEventListener('click', () => {
  if (recognizer.listening) {
    recognizer.stop();
  } else {
    setStatus('');
    recognizer.start();
  }
});

el.clear.addEventListener('click', () => {
  captioner?.clear();
  for (const p of lineEls.values()) p.remove();
  lineEls.clear();
  el.interim.textContent = '';
  el.placeholder.hidden = false;
  if (el.status.classList.contains('error')) setStatus('');
});

// ---------- 文字の大きさ ----------

function applySize(size) {
  document.documentElement.dataset.size = size;
  for (const b of document.querySelectorAll('[data-size]')) {
    b.setAttribute('aria-pressed', String(b.dataset.size === size));
  }
  try { localStorage.setItem(SIZE_KEY, size); } catch {}
}
let savedSize = 'large';
try { savedSize = localStorage.getItem(SIZE_KEY) || 'large'; } catch {}
applySize(savedSize);
for (const b of document.querySelectorAll('[data-size]')) {
  b.addEventListener('click', () => applySize(b.dataset.size));
}

// ---------- 設定 ----------

const FIELDS = ['apiKey', 'model', 'dictionary'];
for (const m of MODELS) el.form.elements.model.add(new Option(m.label, m.id));

el.openSettings.addEventListener('click', () => {
  settings = loadSettings(); // 音声メモのページで変更された場合に備えて読み直す
  for (const k of FIELDS) el.form.elements[k].value = settings[k];
  el.dialog.showModal();
});

el.dialog.addEventListener('close', () => {
  if (el.dialog.returnValue !== 'save') return;
  const next = { ...loadSettings() };
  for (const k of FIELDS) next[k] = el.form.elements[k].value.trim();
  settings = next;
  const ok = saveSettings(settings);
  setStatus(ok ? '設定を保存しました' : '設定を保存できませんでした', !ok);
});
