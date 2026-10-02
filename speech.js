// Chrome 内蔵の音声認識（Web Speech API）の薄いラッパー。

/**
 * @param {{
 *   onInterim: (text: string) => void,  // 確定前の途中結果（今の発話分のみ）
 *   onFinal: (text: string) => void,    // 確定した1区切り
 *   onStateChange: (listening: boolean) => void,
 *   onError: (message: string) => void,
 * }} handlers
 */
export function createRecognizer({ onInterim, onFinal, onStateChange, onError }) {
  const Impl = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
  if (!Impl) {
    return { isSupported: false, start() {}, stop() {}, get listening() { return false; } };
  }

  let rec = null;
  let listening = false;

  function setListening(v) {
    listening = v;
    onStateChange(v);
  }

  function start() {
    if (listening) return;
    rec = new Impl();
    rec.lang = 'ja-JP';
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) {
          if (t.trim()) onFinal(t.trim());
        } else {
          interim += t;
        }
      }
      onInterim(interim);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const messages = {
        'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください。',
        'service-not-allowed': 'マイクの使用が許可されていません。ブラウザの設定で許可してください。',
        'audio-capture': 'マイクが見つかりません。',
        network: '音声認識に必要な通信ができませんでした。',
      };
      onError(messages[e.error] ?? `音声認識エラー: ${e.error}`);
    };
    rec.onend = () => {
      onInterim('');
      setListening(false);
    };

    try {
      rec.start();
      setListening(true);
    } catch (err) {
      onError(`音声認識を開始できませんでした: ${err.message}`);
    }
  }

  function stop() {
    rec?.stop();
  }

  return {
    isSupported: true,
    start,
    stop,
    get listening() { return listening; },
  };
}
