# HANDOFF — voice-memo-obsidian

最終更新: 2026-10-02T22:00+09:00

## Goal
Androidで話した短い音声メモを、フィラー除去・医療用語補正してリアルタイムに整形し、
ボタン1つでObsidian（保管庫 forest）に新規ノートとして作成するPWA。

## Current state
タスク1〜9完了。GitHub Pagesで公開済み: https://forestzz0319.github.io/voice-memo-obsidian/
（リポジトリ https://github.com/forestzz0319/voice-memo-obsidian は公開。コミット作成者はGitHubのnoreplyアドレス）。
公開ページはヘッドレスChromeで読み込み確認済み（エラーなし・SDK読込OK・Service Worker有効）。Android実機での確認待ち。

## Completed
- 設計: `docs/superpowers/specs/2026-10-02-voice-memo-obsidian-design.md`
- 計画: `docs/superpowers/plans/2026-10-02-voice-memo-obsidian-plan.md`
- 純粋関数モジュールと単体テスト: obsidian.js / note.js / prompt.js / settings.js / formatter.js（speech.js含め計46件成功）
- 画面: index.html / style.css / app.js、音声認識 speech.js、PWA manifest.json / sw.js / icons
- PCのヘッドレスChromeで通し確認（API応答は偽物に差し替え）: 原文入力→ストリーミング整形表示、
  手動編集で自動整形停止・再整形ボタン表示、リクエスト内容（モデル・effort・fallbacks・辞書）、Service Worker有効化

## Next steps
1. 更新の公開: コミット後に `git push`（Pagesへは1〜2分で反映）。画面ファイルを変えたら sw.js の `VERSION` も上げる。
   ※Claude Codeのシェルからはpushの認証画面が出ないことがある。その場合はVS Codeのターミナルで手動push。
2. Anthropic Console で本アプリ専用APIキーを作成（利用上限を設定推奨）
3. Android実機チェック:
   1. ChromeでURLを開き「ホーム画面に追加」して起動
   2. ⚙ でAPIキー・保管庫名 `forest`・フォルダ `00_Inbox` を保存
   3. 「えーと、へバーデン決説の患者さんで、あのー、DIP関節の…」と話して補正を確認
   4. 話しながらプレビューが更新される
   5. 本文を手で直すと自動上書きされない／「再整形」で戻る
   6. 「Obsidianへ」→ forest/00_Inbox にノート作成、frontmatter・タグ・折りたたみ原文を確認
   7. 同じタイトルで2回保存したときの挙動を記録
4. sw.js の `VERSION` はファイル更新時に上げる

## Verification
- 単体テスト: `npm test`（Node.js 20以上）
- PCでの画面確認: `npx --yes http-server -p 8080 -c-1` → Chrome で http://localhost:8080
- 未確認: 実際のマイク認識、実APIでの整形品質、Androidでの obsidian:// 起動（実機が必要なため）

## Important files
- `app.js` 画面の結線 / `formatter.js` Claude呼び出し / `prompt.js` 整形指示 / `note.js` ノート組み立て / `obsidian.js` URL生成

## Decisions
- サーバーなし静的PWA、APIキーは端末localStorageのみ（本人専用のため）
- 音声認識はChrome内蔵Web Speech API、確定ごとに1秒デバウンスして原文全体を再整形
- モデル既定 claude-opus-5-5（effort low）、設定でSonnet 5.5に切替可。`fallbacks: "default"` で拒否時に自動振り替え
- SDKは jsDelivr の `@anthropic-ai/sdk@0.131.0/+esm` をバージョン固定で読み込む
- 整形結果はタイトル・タグ・本文の3欄に分けて表示し、どれかを手で編集したら自動整形を止める
- 2026-10-02 実機フィードバックで変更: Chromeが無音で認識を終了しても🎤で止めるまで自動再開し、最大3分（経過時間を表示）。
  終了時に確定前の途中結果は原文に取り込む。ヘッダーの「新規」を「🗑 削除」に変更（確認後に全欄クリア）。sw.js VERSION v2
- 2026-10-02 実機で同じ文が5回ほど重複入力される不具合: Android Chromeのcontinuous:trueの既知不具合。continuous:falseにして自動再開でつなぎ、確定結果の位置と直前の文で重複除去。sw.js VERSION v3
- 患者の個人情報は話さない運用（画面に注意書き）

## Blockers
- なし。別PCで作業する場合はGitとNode.jsが必要（このPCは 2026-10-02 に winget で Node.js LTS 24.19.0 を導入済み）。
