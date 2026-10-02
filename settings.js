// 設定の保存（このスマホのlocalStorageのみ）とエクスポート／インポート。

const KEY = 'voice-memo-obsidian.settings';

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（高精度）' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（約半額・やや速い）' },
];

export const DEFAULT_SETTINGS = Object.freeze({
  apiKey: '',
  model: 'claude-opus-5-5',
  vault: 'forest',
  folder: '00_Inbox',
  dictionary: '',
  tagCandidates: '',
});

function pick(obj) {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (obj && typeof obj[k] === 'string') out[k] = obj[k];
  }
  return out;
}

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? pick(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** @returns {boolean} 保存できたか */
export function saveSettings(settings, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(KEY, JSON.stringify(pick(settings)));
    return true;
  } catch {
    return false;
  }
}

/** APIキーを除いた設定をJSON文字列で返す */
export function exportSettings(settings) {
  const { apiKey, ...rest } = pick(settings);
  return JSON.stringify(rest, null, 2);
}

/** JSONを読み込み、現在のAPIキーは保ったまま設定を返す。不正なJSONは例外。 */
export function importSettings(json, current) {
  const parsed = JSON.parse(json);
  return { ...pick(parsed), apiKey: current.apiKey };
}
