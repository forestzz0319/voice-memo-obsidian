// 字幕ページ用：確定した1文ずつをClaudeで補正する。
// 失敗しても字幕は止めない（原文のまま表示を続ける）。

import { parseDictionary } from './prompt.js';
import { buildCaptionSystemPrompt, buildCaptionUserMessage } from './caption-prompt.js';

const MAX_TOKENS = 1000;

/**
 * @param {{
 *   Anthropic: any,
 *   getSettings: () => {apiKey: string, model: string, dictionary: string},
 *   onUpdate: (id: number, text: string) => void,  // 補正後の文で差し替える
 *   onError: (message: string) => void,
 * }} opts
 */
export function createCaptioner({ Anthropic, getSettings, onUpdate, onError }) {
  /** @type {{id: number, raw: string, fixed: string|null}[]} */
  let lines = [];
  let nextId = 1;
  let generation = 0; // clear() のたびに増やし、古い結果を捨てる
  const inflight = new Set();
  let client = null;
  let clientKey = null;

  function getClient(apiKey) {
    if (!client || clientKey !== apiKey) {
      client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      clientKey = apiKey;
    }
    return client;
  }

  /** 確定した1文を追加し、補正を依頼する。行IDを返す。 */
  function add(sentence) {
    const id = nextId++;
    const context = lines.map((l) => l.fixed ?? l.raw);
    const line = { id, raw: sentence, fixed: null };
    lines.push(line);
    const p = correct(line, context, generation);
    inflight.add(p);
    p.finally(() => inflight.delete(p));
    return id;
  }

  async function correct(line, context, gen) {
    const s = getSettings();
    if (!s.apiKey) {
      onError('補正なし（APIキー未設定）。⚙ 設定から入力してください。');
      return;
    }
    try {
      const res = await getClient(s.apiKey).beta.messages.create({
        model: s.model,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: buildCaptionSystemPrompt({ dictionary: parseDictionary(s.dictionary) }),
        messages: [{ role: 'user', content: buildCaptionUserMessage({ context, sentence: line.raw }) }],
      });
      if (gen !== generation) return;
      if (res.stop_reason === 'refusal') return;
      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();
      if (!acceptable(line.raw, text)) return;
      line.fixed = text;
      onUpdate(line.id, text);
    } catch (err) {
      if (gen !== generation) return;
      const msg = err instanceof Anthropic.APIError
        ? `補正できませんでした（API ${err.status ?? 'エラー'}）。原文のまま表示しています。`
        : '補正できませんでした（通信エラー）。原文のまま表示しています。';
      onError(msg);
    }
  }

  function clear() {
    generation++;
    lines = [];
  }

  /** 実行中の補正がすべて終わるまで待つ（テスト用） */
  async function idle() {
    while (inflight.size > 0) await Promise.allSettled([...inflight]);
  }

  return { add, clear, idle };
}

/** 空や、入力より極端に長い出力（付け足しの疑い）は採用しない */
function acceptable(raw, fixed) {
  if (!fixed) return false;
  return Array.from(fixed).length <= Array.from(raw).length * 2 + 20;
}
