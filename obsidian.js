// Obsidian URI（obsidian://new）の組み立てと、ノートのファイル名の整形。

/** obsidian:// URL がこれを超えたら content をやめてクリップボード経由にする */
export const MAX_URL_LENGTH = 8000;

const FORBIDDEN_CHARS = /[\\/:*?"<>|#^[\]]/g;
const MAX_NAME_LENGTH = 60;

/**
 * Obsidianのファイル名に使えない文字を除去する。
 * @param {string} title
 * @returns {string}
 */
export function sanitizeFileName(title) {
  const cleaned = String(title ?? '')
    .replace(FORBIDDEN_CHARS, '')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  const cut = Array.from(cleaned).slice(0, MAX_NAME_LENGTH).join('').trim();
  return cut || '無題';
}

/**
 * `YYYY-MM-DD タイトル` 形式のファイル名（拡張子なし）を返す。
 * @param {Date} date ローカル時刻で日付を取る
 * @param {string} title
 */
export function buildFileName(date, title) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${ymd} ${sanitizeFileName(title)}`;
}

/**
 * Obsidianで新規ノートを作るURLを返す。
 * 長すぎる場合は useClipboard: true を返すので、呼び出し側で先に
 * クリップボードへノートをコピーしてからURLを開くこと。
 * @param {{vault: string, folder: string, fileName: string, content: string}} p
 * @returns {{url: string, useClipboard: boolean}}
 */
export function buildObsidianUrl({ vault, folder, fileName, content }) {
  const dir = String(folder ?? '').replace(/^\/+|\/+$/g, '');
  const path = dir ? `${dir}/${fileName}` : fileName;
  const base =
    `obsidian://new?vault=${encodeURIComponent(vault)}` +
    `&file=${encodeURIComponent(path)}`;
  const withContent = `${base}&content=${encodeURIComponent(content)}`;
  if (withContent.length <= MAX_URL_LENGTH) {
    return { url: withContent, useClipboard: false };
  }
  return { url: `${base}&clipboard=true`, useClipboard: true };
}
