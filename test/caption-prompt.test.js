import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaptionSystemPrompt, buildCaptionUserMessage } from '../caption-prompt.js';

test('buildCaptionSystemPrompt: 基本の指示（補正・フィラー除去・言い換えない・1文だけ出力）', () => {
  const p = buildCaptionSystemPrompt({ dictionary: [] });
  assert.match(p, /医療用語/);
  assert.match(p, /フィラー/);
  assert.match(p, /言い換え/);
  assert.match(p, /補正後の文だけ/);
  assert.ok(!p.includes('ユーザー辞書'));
});

test('buildCaptionSystemPrompt: 辞書を差し込む', () => {
  const p = buildCaptionSystemPrompt({
    dictionary: [{ from: 'こつそしょう', to: '骨粗鬆症' }, { from: null, to: 'ロキソプロフェン' }],
  });
  assert.match(p, /ユーザー辞書/);
  assert.match(p, /こつそしょう → 骨粗鬆症/);
  assert.match(p, /- ロキソプロフェン/);
});

test('buildCaptionUserMessage: 文脈なし', () => {
  assert.equal(buildCaptionUserMessage({ context: [], sentence: 'えーこれは骨です' }), '<補正する文>\nえーこれは骨です\n</補正する文>');
});

test('buildCaptionUserMessage: 文脈は直前3行まで', () => {
  const m = buildCaptionUserMessage({ context: ['一', '二', '三', '四'], sentence: '五' });
  assert.equal(m, '<直前の発言（参考）>\n二\n三\n四\n</直前の発言（参考）>\n<補正する文>\n五\n</補正する文>');
});
