# StyleTrace

[English](README.md) | 繁體中文 | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace 是一個 MCP 伺服器，會分析網站並回傳精簡的設計語法，供代理與審查者使用。其中一個使用情境，是幫助開發者在不被設計細節分心的情況下建立網站。

![StyleTrace reverse engineering comparison](docs/readme-style-reverse-engineering.png)

## 為什麼使用它

- 把少量參考頁面整理成代理真正能使用的設計語法
- 保留有辨識度的設計特徵，讓網站重建結果不那麼制式
- 只分析你提供的網址，讓結果更可預測也更容易審查

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

伺服器只提供一個工具：`analyze_website_style`。

輸入範例：

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"]
}
```

## 運作方式

StyleTrace 會使用 Playwright 造訪你提供的公開網址。它會擷取精簡且可審查的訊號，例如模組結構、hero 呈現方式、CTA 模式、社會證明區塊、圖像、表單、斷點與代表性設計特徵。它不會額外爬取其他頁面，也不會憑空發明新的設計系統或做推測性的建議。

## 限制

- 僅支援公開 `http` 與 `https` 網址
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

或直接對你自己的公開網址執行：

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## 授權

MIT
