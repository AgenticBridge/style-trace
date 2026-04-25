# StyleTrace

[English](README.md) | [繁體中文](README.zh-TW.md) | 日本語 | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace は、参照元を分析して、エージェントやレビュー担当者のためにプロンプトにそのまま使えるデザインブリーフを返す MCP サーバーです。開発者がデザインの細部に気を取られずに Web サイトを作り、その後に生成結果を元のスタイル制約と照らしてレビューする用途があります。

![StyleTrace reverse engineering comparison](docs/readme-example-1.png)

同じ参照セットで、レビューの流れの中で StyleTrace あり / なしを比較した追加例です。

![StyleTrace with and without comparison](docs/readme-example-2.png)

## 使う理由

- 少数の参照ページ、スクリーンショット、HTML スニペットを、エージェントが実際に使えるプロンプト向けデザインブリーフに変換できる
- 目立つ特徴を保つことで、生成されたサイトが無難すぎるものになりにくい
- 抽出したスタイル制約に対して生成 HTML やスクリーンショットをレビューできるので、曖昧な見た目の判断だけに頼らずに済む
- 指定した参照だけを分析するため、結果が予測しやすくレビューしやすい

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

サーバーは 2 つのツールを公開します。

- `analyze_website_style`
- `review_generated_style`

`analyze_website_style` は正確な Web サイト URL を受け取れます。

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"],
  "targetArtifact": "landing-page",
  "fidelity": "high"
}
```

混在した参照も受け付けます。

```json
{
  "references": [
    { "type": "url", "value": "https://www.apple.com/iphone/" },
    { "type": "image", "value": "https://example-cdn.com/reference/hero-shot.png" },
    { "type": "screenshot", "value": "https://example-cdn.com/reference/hero-capture.png" },
    { "type": "html", "value": "<main><section><h1>Hero</h1></section></main>" }
  ],
  "targetArtifact": "prototype",
  "fidelity": "medium",
  "designIntent": "preserve the hero hierarchy and chrome discipline",
  "evidenceMode": "inline"
}
```

`urls` は Web サイトのみの入力として引き続き使えます。Web サイト、画像、スクリーンショット、境界付き HTML を 1 回のリクエストで混ぜたい場合は `references` を使ってください。

結果には `visualVocabulary`、`styleInvariants`、`styleRisks`、`softGuesses`、`compositionBlueprint`、`variationAxes`、`blendModes`、`promptReadyBrief`、`reviewContract`、`originalityBoundary` などのプロンプト向けフィールドが含まれます。

`review_generated_style` は、生成した HTML または生成画像 URL を StyleTrace の結果と照らして確認します。

```json
{
  "styleResult": { "...": "StyleTrace analyze_website_style output" },
  "generatedHtml": "<!doctype html><html>...</html>",
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

返されるのは、どの制約に一致したか、どれに違反したか、どこでドリフトしたか、そしてレビュー全体の信頼度です。

## 仕組み

`analyze_website_style` は、指定された公開 URL を Playwright で訪問し、直接公開されている画像 URL、スクリーンショット参照、境界付き HTML スニペットも分析できます。モジュール構成、hero の見せ方、CTA パターン、証拠セクション、画像、フォーム、ブレークポイント、シグネチャモチーフのような、絞り込まれていてレビューしやすいシグナルを抽出し、それらを硬い制約、ドリフトのリスク、構成の骨格、レビュー項目を含むプロンプト向けデザインブリーフにまとめます。追加のページをクロールすることはなく、新しいデザインシステムを勝手に作ったり、推測に基づく提案をしたりもしません。

`review_generated_style` は、生成物を同じレンズでもう一度解析し、抽出したスタイル契約と比較します。何が一致し、何がズレて、どこが汎用化したのかを明示することが目的です。

## 制限

- 公開された `http` と `https` URL のみ対応
- 画像とスクリーンショット参照は `.png`、`.jpg`、`.webp`、`.gif`、`.avif`、`.svg` などの直接公開された画像アセットである必要があります
- HTML 参照は境界付きのスニペットであり、完全なブラウジングセッションではありません
- 画像のみ、またはスクリーンショットのみの参照は、実際の Web サイト参照よりもタイポグラフィ、ナビゲーション、フォーム、モーション、ブレークポイントの推論が弱くなります
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

もう 1 つの内蔵比較セット：

```bash
npm run test:e2e -- --instance figma-framer-webflow
```

自分の公開 URL で実行する場合：

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## ライセンス

MIT
