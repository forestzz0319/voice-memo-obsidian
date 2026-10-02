# HANDOFF — voice-memo-obsidian

最終更新: 2026-10-02T00:00+09:00

## Goal
Androidで話した短い音声メモを、フィラー除去・医療用語補正してリアルタイムに整形し、
ボタン1つでObsidian（保管庫 forest）に新規ノートとして作成するPWA。

## Current state
設計完了・ユーザー承認済み。仕様書のユーザーレビュー待ち → 次は実装計画作成。コードは未着手。

## Completed
- 設計仕様: `docs/superpowers/specs/2026-10-02-voice-memo-obsidian-design.md`

## Next steps
1. ユーザーが仕様書を確認・承認
2. 実装計画を作成 → 実装（純粋関数モジュールからTDD）
3. GitHub Pagesで公開、Android実機で手動確認

## Verification
- 単体テスト（実装後）: `node --test test/`

## Decisions
- サーバーなし静的PWA、APIキーは端末localStorageのみ（本人専用のため）
- 音声認識はChrome内蔵Web Speech API、1文確定ごとに約1秒デバウンスして原文全体を再整形
- モデル既定 claude-opus-5-5（effort low）、設定でSonnet 5.5に切替可
- 患者の個人情報は話さない運用
- 整形ロジックは `../voice-translator/lib/buildPrompt.js` を土台にする

## Blockers
- なし（2026-10-02 Git for Windows 2.56.0 導入、リポジトリ初期化・初回コミット済み）。
  別PCで作業する場合はそのPCにもGitが必要。
