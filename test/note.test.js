import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelOutput, fallbackParse, normalizeTags, buildNote } from '../note.js';

const FULL = 'TITLE: 腱板断裂の説明動画ネタ\nTAGS: YouTubeネタ, 肩\n---\n本文1行目。\n\n- 要点\n';

test('parseModelOutput: 完全な出力を解析する', () => {
  const r = parseModelOutput(FULL);
  assert.equal(r.title, '腱板断裂の説明動画ネタ');
  assert.deepEqual(r.tags, ['YouTubeネタ', '肩']);
  assert.equal(r.body, '本文1行目。\n\n- 要点');
  assert.equal(r.hasBody, true);
});

test('parseModelOutput: TITLE行の途中でも例外にならない', () => {
  const r = parseModelOutput('TITLE: 腱板');
  assert.equal(r.title, '腱板');
  assert.deepEqual(r.tags, []);
  assert.equal(r.body, '');
  assert.equal(r.hasBody, false);
});

test('parseModelOutput: 本文の途中まで', () => {
  const r = parseModelOutput('TITLE: t\nTAGS: a\n---\n途中まで');
  assert.equal(r.body, '途中まで');
  assert.equal(r.hasBody, true);
});

test('parseModelOutput: 空文字', () => {
  assert.deepEqual(parseModelOutput(''), { title: '', tags: [], body: '', hasBody: false });
});

test('parseModelOutput: CRLFや前置きの空行を許容する', () => {
  const r = parseModelOutput('\r\nTITLE: t\r\nTAGS: a, b\r\n---\r\nx\r\ny');
  assert.equal(r.title, 't');
  assert.deepEqual(r.tags, ['a', 'b']);
  assert.equal(r.body, 'x\ny');
});

test('fallbackParse: 形式が崩れたら原文の先頭20字をタイトルにし全文を本文にする', () => {
  const transcript = 'えーと今日は肩関節周囲炎の患者さんが多かったのでメモ';
  const r = fallbackParse('整形された文章だけが返ってきた', transcript);
  assert.equal(r.title, Array.from(transcript).slice(0, 20).join(''));
  assert.deepEqual(r.tags, []);
  assert.equal(r.body, '整形された文章だけが返ってきた');
});

test('normalizeTags: #除去・空白置換・重複除去・voice-memoを先頭に', () => {
  assert.deepEqual(
    normalizeTags(['#肩', 'YouTube ネタ', '肩', '', 'voice-memo']),
    ['voice-memo', '肩', 'YouTube_ネタ'],
  );
  assert.deepEqual(normalizeTags([]), ['voice-memo']);
});

test('buildNote: frontmatter・見出し・本文・折りたたみ原文', () => {
  const note = buildNote({
    title: '腱板断裂の説明動画ネタ',
    tags: ['YouTubeネタ'],
    body: '本文。',
    transcript: 'えーと腱板\nあのー五十肩',
    now: new Date(2026, 9, 2, 9, 5),
  });
  assert.equal(
    note,
    [
      '---',
      'created: 2026-10-02T09:05',
      'tags: [voice-memo, YouTubeネタ]',
      'source: 音声メモ',
      '---',
      '# 腱板断裂の説明動画ネタ',
      '',
      '本文。',
      '',
      '> [!note]- 元の音声テキスト',
      '> えーと腱板',
      '> あのー五十肩',
      '',
    ].join('\n'),
  );
});

test('buildNote: 原文が空ならcalloutを付けない', () => {
  const note = buildNote({ title: 't', tags: [], body: 'b', transcript: '  ', now: new Date(2026, 0, 1) });
  assert.ok(!note.includes('[!note]'));
  assert.ok(note.endsWith('b\n'));
});
