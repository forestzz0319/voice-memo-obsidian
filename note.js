// Claudeの出力（TITLE/TAGS/---/本文）の解析と、Obsidianノートの組み立て。

const BASE_TAG = 'voice-memo';
const FALLBACK_TITLE_LENGTH = 20;

/**
 * モデル出力を解析する。ストリーミング途中の不完全な文字列でも例外を出さない。
 * @param {string} text
 * @returns {{title: string, tags: string[], body: string, hasBody: boolean}}
 */
export function parseModelOutput(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  let title = '';
  let tags = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    const m = line.match(/^(TITLE|TAGS)\s*[:：]\s*(.*)$/i);
    if (m) {
      if (m[1].toUpperCase() === 'TITLE') title = m[2].trim();
      else tags = splitTags(m[2]);
      continue;
    }
    break;
  }
  if (i < lines.length && lines[i].trim() === '---') {
    const body = lines.slice(i + 1).join('\n').trim();
    return { title, tags, body, hasBody: true };
  }
  return { title, tags, body: '', hasBody: false };
}

function splitTags(s) {
  return s.split(/[,、，]/).map((t) => t.trim()).filter(Boolean);
}

/**
 * 出力形式が崩れていた場合の救済。全文を本文とし、タイトルは原文の先頭から取る。
 * @param {string} rawOutput
 * @param {string} transcript
 */
export function fallbackParse(rawOutput, transcript) {
  const title = Array.from(String(transcript ?? '').trim())
    .slice(0, FALLBACK_TITLE_LENGTH)
    .join('');
  return { title, tags: [], body: String(rawOutput ?? '').trim() };
}

/**
 * タグを Obsidian で使える形にそろえ、先頭に voice-memo を付ける。
 * @param {string[]} tags
 */
export function normalizeTags(tags) {
  const out = [BASE_TAG];
  for (const t of tags ?? []) {
    const n = String(t).replace(/#/g, '').trim().replace(/\s+/g, '_');
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Obsidianに保存するノート全文（Markdown）を組み立てる。
 * @param {{title: string, tags: string[], body: string, transcript: string, now: Date}} p
 */
export function buildNote({ title, tags, body, transcript, now }) {
  const pad = (n) => String(n).padStart(2, '0');
  const created =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const parts = [
    '---',
    `created: ${created}`,
    `tags: [${normalizeTags(tags).join(', ')}]`,
    'source: 音声メモ',
    '---',
    `# ${title}`,
    '',
    String(body ?? '').trim(),
  ];
  const raw = String(transcript ?? '').trim();
  if (raw) {
    parts.push('', '> [!note]- 元の音声テキスト');
    for (const line of raw.split(/\r?\n/)) parts.push(`> ${line}`);
  }
  return parts.join('\n') + '\n';
}
