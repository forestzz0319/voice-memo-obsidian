import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeFileName,
  buildFileName,
  buildObsidianUrl,
  MAX_URL_LENGTH,
} from '../obsidian.js';

test('sanitizeFileName: 禁止文字を除去する', () => {
  assert.equal(sanitizeFileName('肩/肘:痛み*?"<>|#^[]\\テスト'), '肩肘痛みテスト');
});

test('sanitizeFileName: 前後の空白とピリオドを除去する', () => {
  assert.equal(sanitizeFileName('  .腱板断裂.  '), '腱板断裂');
});

test('sanitizeFileName: 60文字で切る', () => {
  const long = 'あ'.repeat(80);
  assert.equal(sanitizeFileName(long).length, 60);
});

test('sanitizeFileName: 空になったら「無題」', () => {
  assert.equal(sanitizeFileName(''), '無題');
  assert.equal(sanitizeFileName(' ?? '), '無題');
  assert.equal(sanitizeFileName(undefined), '無題');
});

test('buildFileName: YYYY-MM-DD タイトル', () => {
  const d = new Date(2026, 9, 2, 14, 30); // ローカル時刻 2026-10-02
  assert.equal(buildFileName(d, '腱板断裂の動画ネタ'), '2026-10-02 腱板断裂の動画ネタ');
  assert.equal(buildFileName(new Date(2026, 0, 5), 'a/b'), '2026-01-05 ab');
});

test('buildObsidianUrl: 各値をエンコードしてcontentを付ける', () => {
  const { url, useClipboard } = buildObsidianUrl({
    vault: 'forest',
    folder: '00_Inbox',
    fileName: '2026-10-02 テスト',
    content: '# 見出し\n本文 & 記号',
  });
  assert.equal(useClipboard, false);
  assert.equal(
    url,
    'obsidian://new?vault=forest' +
      '&file=' + encodeURIComponent('00_Inbox/2026-10-02 テスト') +
      '&content=' + encodeURIComponent('# 見出し\n本文 & 記号'),
  );
});

test('buildObsidianUrl: フォルダが空ならファイル名だけ（前後のスラッシュも除去）', () => {
  const a = buildObsidianUrl({ vault: 'v', folder: '', fileName: 'x', content: 'c' });
  assert.ok(a.url.includes('&file=x&'));
  const b = buildObsidianUrl({ vault: 'v', folder: '/memo/', fileName: 'x', content: 'c' });
  assert.ok(b.url.includes('&file=' + encodeURIComponent('memo/x') + '&'));
});

test('buildObsidianUrl: 長すぎる場合は clipboard=true に切り替える', () => {
  const content = '長'.repeat(MAX_URL_LENGTH);
  const { url, useClipboard } = buildObsidianUrl({
    vault: 'forest', folder: '00_Inbox', fileName: 'x', content,
  });
  assert.equal(useClipboard, true);
  assert.ok(url.endsWith('&clipboard=true'));
  assert.ok(!url.includes('content='));
});
