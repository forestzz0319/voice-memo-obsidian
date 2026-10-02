import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, exportSettings, importSettings } from '../settings.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('loadSettings: 何もなければ既定値', () => {
  assert.deepEqual(loadSettings(memoryStorage()), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.model, 'claude-opus-5-5');
  assert.equal(DEFAULT_SETTINGS.vault, 'forest');
  assert.equal(DEFAULT_SETTINGS.folder, '00_Inbox');
});

test('save → load で往復し、未知の項目は既定値で補う', () => {
  const s = memoryStorage();
  saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'k', vault: 'v' }, s);
  const loaded = loadSettings(s);
  assert.equal(loaded.apiKey, 'k');
  assert.equal(loaded.vault, 'v');
  assert.equal(loaded.folder, '00_Inbox');
});

test('loadSettings: 壊れたJSONや例外を投げるストレージでも既定値', () => {
  const s = memoryStorage();
  s.setItem('voice-memo-obsidian.settings', '{broken');
  assert.deepEqual(loadSettings(s), DEFAULT_SETTINGS);
  const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadSettings(throwing), DEFAULT_SETTINGS);
  assert.equal(saveSettings(DEFAULT_SETTINGS, throwing), false);
});

test('exportSettings: APIキーを含めない', () => {
  const json = exportSettings({ ...DEFAULT_SETTINGS, apiKey: 'secret', dictionary: 'a → b' });
  assert.ok(!json.includes('secret'));
  assert.equal(JSON.parse(json).dictionary, 'a → b');
});

test('importSettings: 現在のAPIキーを保ち、他を上書きする', () => {
  const current = { ...DEFAULT_SETTINGS, apiKey: 'mine' };
  const r = importSettings(JSON.stringify({ apiKey: 'other', vault: 'x', unknown: 1 }), current);
  assert.equal(r.apiKey, 'mine');
  assert.equal(r.vault, 'x');
  assert.ok(!('unknown' in r));
});

test('importSettings: 不正なJSONは例外', () => {
  assert.throws(() => importSettings('nope', DEFAULT_SETTINGS));
});
