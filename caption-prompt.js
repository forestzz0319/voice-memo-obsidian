// 字幕ページ用：1文ずつの補正プロンプト。

const CONTEXT_LINES = 3;

/**
 * @param {{dictionary: {from: string|null, to: string}[]}} p
 */
export function buildCaptionSystemPrompt({ dictionary }) {
  const lines = [
    'あなたは整形外科の診察室で、医師の説明を字幕にするアシスタントです。',
    '入力は、医師がレントゲンや薬について患者さんに説明している言葉を、音声認識で文字起こしした1文です。字幕は耳の不自由な患者さんが読みます。',
    '',
    '次のとおりに直してください。',
    '- 医学用語・疾患名・薬剤名・解剖用語・検査名が似た音の一般語に誤変換されていたら、文脈から妥当な医療用語に補正する（整形外科・リハビリテーション領域を優先）。',
    '- 「えー」「あのー」「えっと」「まあ」等のフィラー、言い直し、重複を除く。',
    '- 句読点を適切に付ける。',
    '- 意味を変えない。言い換え・要約・説明の付け足しをしない。医師の言葉をできるだけそのまま残す。',
    '- 直前の発言は文脈の参考にするだけで、出力に含めない。',
  ];
  const dict = dictionary ?? [];
  if (dict.length > 0) {
    lines.push('', 'ユーザー辞書（最優先で適用すること）:');
    for (const d of dict) lines.push(d.from ? `- ${d.from} → ${d.to}` : `- ${d.to}`);
    lines.push('矢印のないものは正しい表記です。似た音の語はこの表記にそろえてください。');
  }
  lines.push('', '出力は補正後の文だけとし、説明や引用符を付けないでください。');
  return lines.join('\n');
}

/**
 * @param {{context: string[], sentence: string}} p
 */
export function buildCaptionUserMessage({ context, sentence }) {
  const parts = [];
  const recent = (context ?? []).slice(-CONTEXT_LINES);
  if (recent.length > 0) {
    parts.push('<直前の発言（参考）>', ...recent, '</直前の発言（参考）>');
  }
  parts.push('<補正する文>', sentence, '</補正する文>');
  return parts.join('\n');
}
