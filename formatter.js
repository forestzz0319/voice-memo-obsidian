// Claude API による整形。デバウンスし、新しい依頼が来たら古い依頼は中断する。
// SDK（Anthropic クラス）は外から渡す。ブラウザでは app.js が CDN から読み込んで渡す。

import { buildSystemPrompt, parseDictionary } from './prompt.js';

const MAX_TOKENS = 4000;

/**
 * @param {{
 *   Anthropic: any,
 *   getSettings: () => {apiKey: string, model: string, dictionary: string, tagCandidates: string},
 *   onStart?: () => void,
 *   onDelta: (text: string) => void,
 *   onDone: (text: string) => void,
 *   onError: (message: string) => void,
 *   delayMs?: number,
 *   setTimer?: typeof setTimeout,
 *   clearTimer?: typeof clearTimeout,
 * }} opts
 */
export function createFormatter({
  Anthropic,
  getSettings,
  onStart = () => {},
  onDelta,
  onDone,
  onError,
  delayMs = 1000,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  let timer = null;
  let controller = null;
  let client = null;
  let clientKey = null;

  function getClient(apiKey) {
    if (!client || clientKey !== apiKey) {
      client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      clientKey = apiKey;
    }
    return client;
  }

  function cancel() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    controller?.abort();
    controller = null;
  }

  function schedule(transcript) {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      runNow(transcript);
    }, delayMs);
  }

  async function runNow(transcript) {
    cancel();
    if (!String(transcript ?? '').trim()) return;
    const s = getSettings();
    if (!s.apiKey) {
      onError('APIキーが未設定です。⚙ 設定から入力してください。');
      return;
    }

    const own = new AbortController();
    controller = own;
    onStart();

    const system = buildSystemPrompt({
      dictionary: parseDictionary(s.dictionary),
      tagCandidates: s.tagCandidates.split(/[,、，]/).map((t) => t.trim()).filter(Boolean),
    });

    let text = '';
    try {
      const stream = getClient(s.apiKey).beta.messages.stream(
        {
          model: s.model,
          max_tokens: MAX_TOKENS,
          output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          messages: [{ role: 'user', content: transcript }],
        },
        { signal: own.signal },
      );
      for await (const ev of stream) {
        if (own.signal.aborted) return;
        if (ev.type === 'content_block_start' && ev.content_block?.type === 'fallback') {
          // 拒否→別モデルへ振り替え。途中まで出ていた文章は捨てる。
          text = '';
          onDelta(text);
        } else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          text += ev.delta.text;
          onDelta(text);
        }
      }
      const final = await stream.finalMessage();
      if (own.signal.aborted) return;
      if (final.stop_reason === 'refusal') {
        onError('この内容は整形できませんでした（AIの安全判定）。原文はそのまま残っています。');
        return;
      }
      onDone(text);
    } catch (err) {
      if (own.signal.aborted) return;
      onError(describeError(Anthropic, err));
    } finally {
      if (controller === own) controller = null;
    }
  }

  return { schedule, runNow, cancel };
}

function describeError(Anthropic, err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'APIキーが正しくありません（401）。⚙ 設定を確認してください。';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'API が混雑しているか利用上限に達しました（429）。少し待って再整形してください。';
  }
  if (err instanceof Anthropic.APIError) {
    return `API エラー（${err.status ?? '不明'}）: ${err.message}`;
  }
  return `通信できませんでした: ${err?.message ?? err}`;
}
