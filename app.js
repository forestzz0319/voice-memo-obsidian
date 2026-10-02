// 画面の状態管理と各モジュールの結線。

import { createRecognizer } from './speech.js';
import { createFormatter } from './formatter.js';
import { parseModelOutput, fallbackParse, buildNote } from './note.js';
import { buildFileName, buildObsidianUrl } from './obsidian.js';
import {
  MODELS, loadSettings, saveSettings, exportSettings, importSettings,
} from './settings.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';

const $ = (id) => document.getElementById(id);
const el = {
  raw: $('raw'), interim: $('interim'),
  title: $('title'), tags: $('tags'), body: $('body'),
  status: $('status'), mic: $('btn-mic'), save: $('btn-save'), copy: $('btn-copy'),
  reformat: $('btn-reformat'), newMemo: $('btn-new'), openSettings: $('btn-settings'),
  dialog: $('settings'), form: $('settings-form'),
  exportBtn: $('btn-export'), importFile: $('import-file'),
};

let settings = loadSettings();
let manualEdit = false;

// ---------- 表示 ----------

function setStatus(text, isError = false) {
  el.status.textContent = text;
  el.status.classList.toggle('error', isError);
}

function setManualEdit(v) {
  manualEdit = v;
  el.reformat.hidden = !v && !el.status.classList.contains('error');
}

function showParsed({ title, tags, body }) {
  el.title.value = title;
  el.tags.value = tags.join(', ');
  el.body.value = body;
}

function hasContent() {
  return Boolean(el.raw.value.trim() || el.body.value.trim() || el.title.value.trim());
}

// ---------- 整形 ----------

let formatter = null;
try {
  const { default: Anthropic } = await import(SDK_URL);
  formatter = createFormatter({
    Anthropic,
    getSettings: () => settings,
    onStart: () => setStatus('整形中…'),
    onDelta: (text) => {
      if (manualEdit) return;
      const p = parseModelOutput(text);
      if (p.title || p.hasBody) showParsed(p);
    },
    onDone: (text) => {
      if (manualEdit) return;
      const p = parseModelOutput(text);
      showParsed(p.hasBody && p.body ? p : fallbackParse(text, el.raw.value));
      setStatus('整形済み');
      el.reformat.hidden = true;
    },
    onError: (message) => {
      setStatus(message, true);
      el.reformat.hidden = false;
    },
  });
} catch (err) {
  setStatus(`AI整形の部品を読み込めませんでした（通信を確認）: ${err.message}`, true);
}

function requestFormat({ immediate = false } = {}) {
  if (!formatter || manualEdit) return;
  if (immediate) formatter.runNow(el.raw.value);
  else formatter.schedule(el.raw.value);
}

// ---------- 音声認識 ----------

const recognizer = createRecognizer({
  onInterim: (t) => { el.interim.textContent = t; },
  onFinal: (t) => {
    el.raw.value = el.raw.value ? `${el.raw.value}\n${t}` : t;
    requestFormat();
  },
  onStateChange: (listening) => {
    el.mic.classList.toggle('on', listening);
    el.mic.setAttribute('aria-label', listening ? '録音停止' : '録音開始');
    el.mic.textContent = listening ? '■' : '🎤';
    if (listening) setStatus('聞き取り中…');
    else if (el.status.textContent === '聞き取り中…') setStatus('');
  },
  onError: (m) => setStatus(m, true),
});

if (!recognizer.isSupported) {
  el.mic.disabled = true;
  setStatus('このブラウザは音声認識に対応していません。原文欄に入力（キーボードの音声入力も可）すれば整形できます。', true);
}

el.mic.addEventListener('click', () => {
  if (recognizer.listening) recognizer.stop();
  else recognizer.start();
});

// ---------- 入力欄 ----------

el.raw.addEventListener('input', () => requestFormat());

for (const field of [el.title, el.tags, el.body]) {
  field.addEventListener('input', () => {
    if (!manualEdit) {
      formatter?.cancel();
      setManualEdit(true);
      setStatus('手動編集中（自動整形は止まっています）');
    }
  });
}

el.reformat.addEventListener('click', () => {
  if (manualEdit && !confirm('手で直した内容を破棄して、原文から整形し直しますか？')) return;
  setManualEdit(false);
  requestFormat({ immediate: true });
});

el.newMemo.addEventListener('click', () => {
  if (hasContent() && !confirm('今のメモを消して新しく始めますか？')) return;
  formatter?.cancel();
  recognizer.stop();
  el.raw.value = '';
  el.interim.textContent = '';
  showParsed({ title: '', tags: [], body: '' });
  setManualEdit(false);
  setStatus('');
});

// ---------- 保存・コピー ----------

function currentNote() {
  const title = el.title.value.trim() || fallbackParse('', el.raw.value).title || '無題';
  const tags = el.tags.value.split(/[,、，]/).map((t) => t.trim()).filter(Boolean);
  const now = new Date();
  const note = buildNote({ title, tags, body: el.body.value, transcript: el.raw.value, now });
  return { note, fileName: buildFileName(now, title) };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

el.copy.addEventListener('click', async () => {
  if (!hasContent()) return;
  const ok = await copyText(currentNote().note);
  setStatus(ok ? 'ノートをコピーしました' : 'コピーできませんでした', !ok);
});

el.save.addEventListener('click', async () => {
  if (!el.body.value.trim()) {
    setStatus('整形結果が空です。', true);
    return;
  }
  const { note, fileName } = currentNote();
  const { url, useClipboard } = buildObsidianUrl({
    vault: settings.vault, folder: settings.folder, fileName, content: note,
  });
  if (useClipboard && !(await copyText(note))) {
    setStatus('長いノートのためクリップボード経由で渡す必要がありますが、コピーに失敗しました。', true);
    return;
  }
  setStatus('Obsidianを開いています…');
  location.href = url;
  setTimeout(() => {
    if (document.visibilityState === 'visible') {
      setStatus('Obsidianが開かない場合は、アプリが入っているか・保管庫名が正しいか確認し、「コピー」で貼り付けてください。', true);
    }
  }, 2500);
});

// ---------- 設定 ----------

const modelSelect = el.form.elements.model;
for (const m of MODELS) modelSelect.add(new Option(m.label, m.id));

function fillForm(s) {
  for (const k of Object.keys(s)) {
    if (el.form.elements[k]) el.form.elements[k].value = s[k];
  }
}

function readForm() {
  const s = {};
  for (const k of Object.keys(settings)) {
    if (el.form.elements[k]) s[k] = el.form.elements[k].value.trim();
  }
  return { ...settings, ...s };
}

el.openSettings.addEventListener('click', () => {
  fillForm(settings);
  el.dialog.showModal();
});

el.dialog.addEventListener('close', () => {
  if (el.dialog.returnValue !== 'save') return;
  settings = readForm();
  const ok = saveSettings(settings);
  setStatus(ok ? '設定を保存しました' : '設定を保存できませんでした（ブラウザの保存領域が使えません）', !ok);
});

el.exportBtn.addEventListener('click', () => {
  const blob = new Blob([exportSettings(readForm())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'voice-memo-settings.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files?.[0];
  if (!file) return;
  try {
    fillForm(importSettings(await file.text(), readForm()));
    alert('読み込みました。「保存」を押すと反映されます。');
  } catch {
    alert('設定ファイルを読み込めませんでした。');
  }
  el.importFile.value = '';
});

if (!settings.apiKey) setStatus('最初に ⚙ 設定で APIキーを入力してください。');

// ---------- PWA ----------

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
