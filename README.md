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
