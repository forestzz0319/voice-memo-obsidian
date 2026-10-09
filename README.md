# 音声メモ → Obsidian（voice-memo-obsidian）

Androidのスマホで話した短いメモを、フィラー（「えー」「あのー」）除去と
医療用語の誤変換補正をしながらリアルタイムに整形し、ボタン1つで
Obsidianの新規ノートとして保存するWebアプリ（PWA）です。

設計: [`docs/superpowers/specs/2026-10-02-voice-memo-obsidian-design.md`](docs/superpowers/specs/2026-10-02-voice-memo-obsidian-design.md)

## 使い方

1. Android の Chrome で公開URLを開き、メニューから「ホーム画面に追加」
2. ⚙ 設定で Anthropic の APIキー、保管庫名（例: `forest`）、保存フォルダを入力
3. 🎤 を押して話す。話している間に下の欄へ整形結果が表示される
4. 「Obsidianへ」でObsidianアプリに新規ノートが作成される

⚠️ 話した内容は Anthropic の Claude API に送信されます。
患者様の氏名・ID・生年月日など個人を特定できる情報は話さないでください。

APIキーはこのスマホのブラウザ内（localStorage）にだけ保存され、
どこにもアップロードされません。

## 開発

ビルド不要の静的ファイルです。単体テスト（Node.js 20以上）:

```
npm test
```

PCで動作確認する場合は、このフォルダで簡易サーバーを立てて Chrome で開きます
（`localhost` ならHTTPSなしでもマイクが使えます）。

```
npx --yes http-server -p 8080 -c-1
```

## 説明字幕（PC用）

診察室のPCで、レントゲンや薬の説明を大きな字幕にして耳の不自由な方に読んでもらうページです。
Google Chrome で `caption.html`（公開URLの末尾に `caption.html`）を開き、「▶ 開始」で話します。
話している途中の文字がすぐ表示され、1文ごとにClaudeが医療用語の補正とフィラー除去をした文に差し替わります。
APIキー・モデル・ユーザー辞書は ⚙ 設定（音声メモのページと共通）。字幕は保存されません。

設計: [`docs/superpowers/specs/2026-10-09-caption-page-design.md`](docs/superpowers/specs/2026-10-09-caption-page-design.md)
