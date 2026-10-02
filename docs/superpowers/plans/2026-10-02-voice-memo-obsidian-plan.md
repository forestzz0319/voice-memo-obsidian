# voice-memo-obsidian 実装計画

- 仕様: `docs/superpowers/specs/2026-10-02-voice-memo-obsidian-design.md`
- 方針: 純粋関数モジュール（prompt / note / obsidian）を先にTDDで作り、次にブラウザ依存部分、最後にPWA化と公開。
- モジュール形式: ES Modules（`export`）。ブラウザは `<script type="module">`、テストは `node --test`（`package.json` に `"type": "module"`、依存パッケージなし）。
- 各タスク完了ごとにコミットする。

## タスク1: 雛形
- `package.json`（`"type": "module"`, `"scripts": {"test": "node --test test/"}`）、`.gitignore`、`README.md`（使い方・個人情報を話さない注意）
- 確認: `npm test` が「テスト0件」で正常終了

## タスク2: `obsidian.js`（TDD）
- `sanitizeFileName(title)`: 禁止文字 `\ / : * ? " < > | # ^ [ ]` 除去、前後の空白・ピリオド除去、60文字で切る、空なら `無題`
- `buildFileName(date, title)`: `YYYY-MM-DD タイトル`
- `buildObsidianUrl({vault, folder, fileName, content})` → `{url, useClipboard}`。8,000文字超なら `content` の代わりに `clipboard=true`、`useClipboard: true`
- テスト: 禁止文字・長さ・空タイトル・日本語のエンコード・フォルダ空・長文で切替

## タスク3: `note.js`（TDD）
- `parseModelOutput(text)` → `{title, tags, body, complete}`。`TITLE:` / `TAGS:` / `---` を逐次解析。途中状態でも例外なし
- `fallbackParse(raw, rawTranscript)`: 形式崩れ時（`---` が来ないまま完了）→ タイトル＝原文の先頭20字、タグなし、全文を本文
- `normalizeTags(tags)`: `#` 除去、空白→`_`、重複除去、先頭に `voice-memo`
- `buildNote({title, tags, body, transcript, now})`: frontmatter（`created: YYYY-MM-DDTHH:mm`）＋ `# タイトル` ＋本文＋折りたたみcallout（各行に `> `）
- テスト: 正常出力、途中まで（TITLEのみ／本文途中）、形式崩れ、タグ正規化、callout複数行、frontmatter形式

## タスク4: `prompt.js`（TDD）
- `buildSystemPrompt({dictionary, tagCandidates})`: 仕様のシステムプロンプト。辞書・タグ候補が空なら該当セクションを出さない
- `parseDictionary(text)`: 1行1件、`誤 → 正`（`->` も可）または単語のみ。空行・前後空白を無視
- テスト: 辞書あり/なし、矢印2種、タグ候補あり/なし、出力形式の指示が含まれること

## タスク5: `settings.js`
- `loadSettings()` / `saveSettings(s)`（localStorage、try/catch）、既定値は仕様の表
- `exportSettings(s)`（apiKeyを除いたJSON）/ `importSettings(json, current)`（apiKeyは現在値を保持）
- export/importの部分はlocalStorageを渡せる形にして単体テスト

## タスク6: `formatter.js`
- `createFormatter({getSettings, onDelta, onDone, onError})` → `{schedule(transcript), runNow(transcript), cancel()}`
- `schedule`: 1秒デバウンス。実行中なら `AbortController` で中断してから新規実行
- SDKはjsDelivrのESMから `import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk/+esm'`（バージョン固定）、`dangerouslyAllowBrowser: true`
- `client.beta.messages.stream({model, max_tokens: 4000, output_config: {effort: 'low'}, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', system, messages})`、テキスト差分ごとに `onDelta(累積テキスト)`
- 終了時に `stop_reason` を確認（`refusal` はエラー扱い）。中断（AbortError）は通知しない。401/429/5xx/ネットワークはエラーメッセージを分けて `onError`
- 実装前にclaude-apiスキルのTypeScript README / streaming.md でSDKの書き方を確認する
- 確認: 手動（PCのChromeで原文欄に手入力 → 整形がストリーミング表示される）

## タスク7: `speech.js`
- `createRecognizer({onInterim, onFinal, onStateChange, onError})` → `{start(), stop(), isSupported}`
- `ja-JP`, `continuous: true`, `interimResults: true`。`onend` で待機状態へ。非対応時は `isSupported: false`
- 確認: 手動（PCのChromeで話す → 原文欄に追記される）

## タスク8: 画面 `index.html` / `style.css` / `app.js`
- メイン: 原文欄（編集可）、プレビュー欄（編集可、ストリーミング表示）、🎤／Obsidianへ／コピー／再整形／新規メモ、状態表示、個人情報注意の一文
- 設定パネル: APIキー、モデル選択、保管庫名、フォルダ、辞書、タグ候補、エクスポート/インポート
- 状態: 手動編集モード（プレビュー編集で自動上書き停止、「再整形」で確認後に再開）
- Obsidianへ: `buildNote` → `buildObsidianUrl` → `useClipboard` なら先にクリップボードへコピー → `location.href = url`
- スマホ縦画面前提、16px余白、ボタンは親指で押せる大きさ。ダークモード対応

## タスク9: PWA化
- `manifest.json`（name, start_url, display: standalone, アイコン192/512）、`sw.js`（静的ファイルのみキャッシュ、APIは素通し）、アイコン生成

## タスク10: 公開と実機確認
- GitHubリポジトリ作成 → push → GitHub Pages有効化（ユーザー操作が必要な箇所は手順を案内。外部公開になるので実施前に確認を取る）
- Android実機チェックリスト（HANDOFFに記載）:
  1. ホーム画面に追加して起動
  2. 設定入力（APIキー、保管庫名）
  3. 医療用語サンプル（例:「えーと、へバーデン決説の患者さんで、あのー、DIP関節の…」）で補正確認
  4. 話しながらプレビューが更新される
  5. プレビュー手動編集 → 自動上書きされない
  6. Obsidianへ → forest/00_Inbox にノート作成、frontmatter・タグ・callout確認
  7. 同名タイトルで2回保存した時の挙動を記録
- `npm test` 全件成功、HANDOFF.md更新
