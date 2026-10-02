import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, parseDictionary } from '../prompt.js';

test('parseDictionary: 矢印2種・単語のみ・空行と空白を扱う', () => {
  const dict = parseDictionary('へバーデン決説 → ヘバーデン結節\n\n  腱板 -> 腱板断裂 \nロコモティブシンドローム\n');
  assert.deepEqual(dict, [
    { from: 'へバーデン決説', to: 'ヘバーデン結節' },
    { from: '腱板', to: '腱板断裂' },
    { from: null, to: 'ロコモティブシンドローム' },
  ]);
  assert.deepEqual(parseDictionary(''), []);
  assert.deepEqual(parseDictionary(undefined), []);
});

test('buildSystemPrompt: 基本の指示と出力形式を含む', () => {
  const p = buildSystemPrompt({ dictionary: [], tagCandidates: [] });
  assert.match(p, /フィラー/);
  assert.match(p, /医療用語/);
  assert.match(p, /TITLE: /);
  assert.match(p, /TAGS: /);
  assert.match(p, /^---$/m);
  assert.ok(!p.includes('ユーザー辞書'));
  assert.ok(!p.includes('タグ候補'));
});

test('buildSystemPrompt: 辞書とタグ候補を差し込む', () => {
  const p = buildSystemPrompt({
    dictionary: [
      { from: 'へバーデン決説', to: 'ヘバーデン結節' },
      { from: null, to: 'ロコモ' },
    ],
    tagCandidates: ['YouTubeネタ', '肩'],
  });
  assert.match(p, /ユーザー辞書/);
  assert.match(p, /へバーデン決説 → ヘバーデン結節/);
  assert.match(p, /- ロコモ/);
  assert.match(p, /タグ候補: YouTubeネタ, 肩/);
});
