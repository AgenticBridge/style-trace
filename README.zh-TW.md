# StyleTrace

[English](README.md) | 繁體中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace 是一個 MCP 伺服器，會分析參考資料並回傳可直接用於提示的設計簡報，供代理與審查者使用。其中一個使用情境，是幫助開發者在不被設計細節分心的情況下建立網站，並在之後對生成結果做風格比對。

![StyleTrace reverse engineering comparison](docs/readme-example-1.png)

額外範例：使用同一組參考資料，在審查流程中比較有無 StyleTrace 的差異：

![StyleTrace with and without comparison](docs/readme-example-2.png)

## 為什麼使用它

- 把少量參考頁面、截圖或 HTML 片段整理成代理真正能使用的提示式設計簡報
- 保留有辨識度的設計特徵，讓網站重建結果不那麼制式
- 用抽出的風格約束來審查生成的 HTML 或截圖，而不是只靠模糊的視覺印象判斷
- 只分析你提供的參考來源，讓結果更可預測也更容易審查

## 安裝

需求：

- Node.js `>=20`
- Playwright Chromium

從 npm 安裝：

```bash
npm install -g @agenticbridge/style-trace
npx playwright install chromium
```

或從本機原始碼執行：

```bash
npm install
npx playwright install chromium
npm run build
```

## 用法

從你的 MCP client 連線使用。

已發布套件：

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

本機原始碼：

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

伺服器提供兩個工具：

- `analyze_website_style`
- `review_generated_style`

`analyze_website_style` 可接受精確網站網址：

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"],
  "targetArtifact": "landing-page",
  "fidelity": "high"
}
```

也可接受混合參考來源：

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

`urls` 仍然支援純網站輸入。當你想在同一個請求中混合網站、圖片、截圖與有邊界的 HTML 來源時，請使用 `references`。

回傳結果現在會包含可直接用於提示的欄位，例如 `visualVocabulary`、`styleInvariants`、`styleRisks`、`softGuesses`、`compositionBlueprint`、`variationAxes`、`blendModes`、`promptReadyBrief`、`reviewContract` 與 `originalityBoundary`。

`review_generated_style` 會拿生成的 HTML 或生成圖片網址，對照 StyleTrace 結果做審查：

```json
{
  "styleResult": { "...": "StyleTrace analyze_website_style output" },
  "generatedHtml": "<!doctype html><html>...</html>",
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

它會回傳哪些約束有命中、哪些被違反、哪些地方產生了漂移，以及整體審查信心。

## 運作方式

`analyze_website_style` 會使用 Playwright 造訪你提供的公開網站網址，也可以分析直接公開的圖片網址、截圖參考與有邊界的 HTML 片段。它會擷取精簡且可審查的訊號，例如模組結構、hero 呈現方式、CTA 模式、社會證明區塊、圖像、表單、斷點與代表性設計特徵，然後把這些訊號整理成可直接用於提示的設計簡報，包含硬性約束、漂移風險、構圖結構與審查檢查點。它不會額外爬取其他頁面，也不會憑空發明新的設計系統或做推測性的建議。

`review_generated_style` 會用相同的分析方式回頭檢查生成產物，並與抽出的風格契約做比較。目標是把風格審查具體化：哪些命中了、哪些漂移了、哪些地方變得過度通用。

## 限制

- 僅支援公開 `http` 與 `https` 網址
- 圖片與截圖參考必須是直接公開的圖片資產，例如 `.png`、`.jpg`、`.webp`、`.gif`、`.avif` 或 `.svg`
- HTML 參考是有邊界的片段，不是完整瀏覽工作階段
- 純圖片或純截圖參考對排版、導覽、表單、動態與斷點的推論會比即時網站參考更弱
- 不支援登入流程或私有網路目標
- 僅支援 stdio transport
- 不提供持久化、佇列或 Web UI

## 貢獻與測試

執行本機檢查：

```bash
npm run typecheck
npm run build
npm test
```

執行 MCP transport smoke test：

```bash
npm run test:mcp-cli
```

執行完整審查流程，包含來源擷圖、`with MCP` 與 `without MCP` 的 LLM 生成，以及合成比較圖：

```bash
npm run test:e2e -- --instance apple-pixel-samsung
```

另一組內建比較案例：

```bash
npm run test:e2e -- --instance figma-framer-webflow
```

或直接對你自己的公開網址執行：

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## 授權

MIT
