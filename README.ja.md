# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace は、Web サイトを分析し、エージェントやレビュー担当者のためにコンパクトなデザイン文法を返す MCP サーバーです。開発者がデザインの細部に気を取られずに Web サイトを作るのを助ける用途があります。

![StyleTrace reverse engineering comparison](docs/readme-style-reverse-engineering.png)

## 使う理由

- 少数の参照ページを、エージェントが実際に使える明確なデザイン文法に変換できる
- 目立つ特徴を保つことで、生成されたサイトが無難すぎるものになりにくい
- 指定した URL だけを分析するため、結果が予測しやすくレビューしやすい

## インストール

必要なもの：

- Node.js `>=20`
- Playwright Chromium

npm からインストール：

```bash
npm install -g @agenticbridge/style-trace
npx playwright install chromium
```

ローカルクローンから実行する場合：

```bash
npm install
npx playwright install chromium
npm run build
```

## 使い方

MCP クライアントから接続してください。

公開パッケージ：

```json
{
  "mcpServers": {
    "style-trace": {
      "command": "npx",
      "args": ["-y", "@agenticbridge/style-trace"]
    }
  }
}
```

ローカルクローン：

```json
{
  "mcpServers": {
    "style-trace": {
      "command": "node",
      "args": ["/absolute/path/to/style-trace/dist/src/index.js"]
    }
  }
}
```

サーバーが公開するツールは 1 つだけです：`analyze_website_style`。

入力例：

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"]
}
```

## 仕組み

StyleTrace は、指定された公開 URL を Playwright で訪問します。モジュール構成、hero の見せ方、CTA パターン、証拠セクション、画像、フォーム、ブレークポイント、シグネチャモチーフのような、絞り込まれたレビューしやすいシグナルを抽出します。追加のページをクロールすることはなく、新しいデザインシステムを勝手に作ったり、推測に基づく提案をしたりもしません。

## 制限

- 公開された `http` と `https` URL のみ対応
- 認証フローやプライベートネットワーク先には非対応
- stdio transport のみ
- 永続化、キュー、Web UI はなし

## コントリビュートとテスト

ローカルチェック：

```bash
npm run typecheck
npm run build
npm test
```

MCP transport のスモークテスト：

```bash
npm run test:mcp-cli
```

ソースキャプチャ、`with MCP` / `without MCP` の LLM 生成、比較ボードまで含む完全なレビュー手順：

```bash
npm run test:e2e -- --instance apple-pixel-samsung
```

自分の公開 URL で実行する場合：

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## ライセンス

MIT
