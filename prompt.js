// 整形用システムプロンプトの組み立て。
// ../voice-translator/lib/buildPrompt.js の医療用語補正・フィラー除去の指示を土台にしている。

/**
 * ユーザー辞書のテキスト（1行1件）を解析する。
 * `誤 → 正` / `誤 -> 正` は置換ペア、矢印なしの行は「正しい語」として扱う。
 * @param {string} text
 * @returns {{from: string|null, to: string}[]}
 */
export function parseDictionary(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.split(/\s*(?:→|->)\s*/);
    if (m.length >= 2 && m[0] && m[1]) out.push({ from: m[0], to: m[1] });
    else out.push({ from: null, to: line.replace(/\s*(?:→|->)\s*/g, '') });
  }
  return out;
}

/**
 * @param {{dictionary: {from: string|null, to: string}[], tagCandidates: string[]}} p
 * @returns {string}
 */
export function buildSystemPrompt({ dictionary, tagCandidates }) {
  const lines = [
    'あなたは整形外科医の音声メモを清書するアシスタントです。',
    '入力は、医師が自分用のアイデア・気づき・勉強メモをスマートフォンに話し、音声認識で文字起こしした日本語の文章です。',
    '',
    '次の手順で清書してください。',
    '1. 医学用語・疾患名・薬剤名・解剖用語・検査名が、似た音の一般語などに誤変換されている場合があります。文脈から最も妥当な医療用語に補正してください（整形外科・リハビリテーション領域を優先）。',
    '2. 「えー」「あのー」「えっと」「まあ」等のフィラー、言い直し、重複を除去してください。',
    '3. 意味を変えずに自然な書き言葉に整えてください。話していない内容を追加したり、推測で補ったりしないでください。',
    '4. 内容が複数の論点を含む場合のみ、本文の後に要点の箇条書き（「- 」で始まる）を付けてください。短いメモには付けないでください。',
    '5. 内容を表すタイトル（20字程度）と、タグを1〜3個付けてください。',
  ];

  const dict = dictionary ?? [];
  if (dict.length > 0) {
    lines.push('', 'ユーザー辞書（最優先で適用すること）:');
    for (const d of dict) {
      lines.push(d.from ? `- ${d.from} → ${d.to}` : `- ${d.to}`);
    }
    lines.push('矢印のないものは正しい表記です。似た音の語はこの表記にそろえてください。');
  }

  const tags = tagCandidates ?? [];
  if (tags.length > 0) {
    lines.push('', `タグ候補: ${tags.join(', ')}`, '当てはまるものがあればタグ候補から優先して選んでください。');
  }

  lines.push(
    '',
    '出力は次の形式のみとし、前後に説明やコードブロック記法を付けないでください。本文に「#」見出しは付けないでください。',
    'TITLE: タイトル',
    'TAGS: タグ1, タグ2',
    '---',
    '本文（Markdown）',
  );
  return lines.join('\n');
}
