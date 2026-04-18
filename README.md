# StyleTrace

English | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933)
![TypeScript](https://img.shields.io/badge/built%20with-TypeScript-3178C6)
![Playwright](https://img.shields.io/badge/browser-Playwright-45BA4B)
![MCP](https://img.shields.io/badge/protocol-MCP-6f42c1)
![npm downloads](https://img.shields.io/npm/dm/@agenticbridge/style-trace)

StyleTrace is an MCP server that analyzes websites and returns a compact design grammar for agents and reviewers. One use case is helping developers build websites without getting distracted by design decisions.

![StyleTrace reverse engineering comparison](docs/readme-style-reverse-engineering.png)

## Why Use It

- turn a few reference pages into a clear design grammar an agent can actually use
- make website regeneration less generic by preserving the parts that feel distinctive
- analyze only the exact URLs you give it, so the result stays predictable and reviewable

## Installation

Requirements:

- Node.js `>=20`
- Playwright Chromium

Install from npm:

```bash
npm install -g @agenticbridge/style-trace
npx playwright install chromium
```

Or run from a local clone:

```bash
npm install
npx playwright install chromium
npm run build
```

## Usage

Connect it from your MCP client.

Published package:

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

Local clone:

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

The server exposes one tool: `analyze_website_style`.

Example input:

```json
{
  "urls": ["https://www.apple.com", "https://www.framer.com"]
}
```

## How It Works

StyleTrace visits exactly the public URLs you provide with Playwright. It extracts narrow, reviewable signals such as module structure, hero treatment, CTA patterns, proof modules, imagery, forms, breakpoints, and signature motifs. It does not crawl additional pages, and it does not try to invent a new design system or make speculative recommendations.

## Limits

- public `http` and `https` URLs only
- no auth flows or private-network targets
- stdio transport only
- no persistence, queueing, or web UI

## Contributing and Testing

Run the local checks:

```bash
npm run typecheck
npm run build
npm test
```

For a real MCP transport smoke test:

```bash
npm run test:mcp-cli
```

For the full review artifact flow with source captures, `with MCP` vs `without MCP` LLM regeneration, and a composite diff board:

```bash
npm run test:e2e -- --instance apple-pixel-samsung
```

Or run it against your own public URLs:

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com https://www.framer.com
```

## License

MIT
