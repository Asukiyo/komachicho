# 移行時のセキュリティ確認

確認日：2026-10-29（日本時間）

## 依存関係

旧版ロックファイルの`npm audit --package-lock-only`では、28パッケージに関連する既知の脆弱性が報告されました（Critical 1 / High 18 / Moderate 8 / Low 1）。開発用・間接依存を含み、28件すべてが公開中のゲームで悪用可能だったと断定するものではありません。

GitHub Pages版では以下を実施しています。

| 項目 | 変更 |
| --- | --- |
| Vite | 8.0.13 → 8.3.5 |
| React / React DOM | 19.2.6 → 19.3.1 |
| Zod | 3.25.76 → 4.6.7。保存データのスキーマも移行 |
| Tailwind CSS | 4.2.1 → 4.3.3 |
| esbuild | 0.28.2を直接固定 |
| Next.js / Vinext / React Server Components | 静的配信では不要なので削除 |
| Cloudflare / Wrangler / Drizzle | サーバーとDBを使用しないため削除 |
| その他 | 未使用のUI・開発パッケージを削除し、ロックファイルを再生成 |

更新後の`npm audit`は開発用を含め **0件**。機械可読の監査結果は`security-audit.json`です。
これは確認時点でnpm監査が把握している脆弱性の結果であり、未知の問題がないことを保証するものではありません。

公式情報：
- [Vite: 開発サーバーのファイルアクセス制限に関する修正](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22)
- [React Server Componentsの修正対象と影響範囲](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3)
- [GitHub Pagesの静的サイト配信](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## 学習コードと保存データ

- HTML/Reactのプレビューは`allow-scripts`のみのsandbox iframe。`allow-same-origin`は付けません。
- 基礎TypeScriptの実行Workerも、アプリとは別オリジン扱いのsandbox iframe内で作成します。
- 実行領域のCSPで外部通信・フォーム送信を禁止します。教材の通信練習は模擬APIです。
- 受信メッセージは送信元iframeと実行IDを照合します。
- 型チェックを行うWorkerはソースを解析するだけで実行しません。
- ループの計数制限・処理時間の監視を維持しています。任意のコードによる全種類のCPU/メモリ消費を完全には制限できません。
- 保存データの形式、識別子、コード長、時刻、座標を検証します。バックアップは2MB以下。
- 壊れた保存データを自動的に初期化しません。保存容量の不足もエラーにします。
- 同時保存にはWeb Locksを使用します。明示的なバックアップの取り込み以外で進捗全体を置き換えません。
- 報酬・納品は個人学習用のローカル状態です。競争型ゲーム向けの改ざん防止サーバーではありません。

## 確認した内容

- 本番ビルドとTypeScriptの型チェック。
- 町の24段階・8ページの動作チェック式、基礎32課題の型チェックと62個の実行アサーション。
- 保存・同時更新・旧形式の読み込み・報酬の重複防止・納品後の更新・バックアップ・容量不足時の処理。
- Blenderモデルの読み込み、独立した人物リグ、歩行アニメーション、8か所の入口と店内の移動経路。
- GitHub Pagesのサブディレクトリに対応したHTML、Worker、モデル、音声の配置。

GitHubへのアップロード・公開設定が完了するまでは、実際のgithub.io上の動作確認は未実施です。
