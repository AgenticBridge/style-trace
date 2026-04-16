# StyleTrace

StyleTrace is a compact TypeScript/Node MCP server that analyzes one or more public website homepages with Playwright and returns an evidence-first style profile.

## What it exposes

- exactly one MCP tool: `analyze_website_style`
- stdio transport only
- structured JSON output for agents
- short Markdown summary for humans

## Input shape

```ts
analyze_website_style({
  urls: string[],
  maxPagesPerSite?: number, // total pages per site including homepage, capped at 5
  pageSelectionMode?: "auto" | "homepage-only",
  synthesisMode?: "single-site-profile" | "cross-site-commonality",
  outputFormat?: "json" | "json+markdown"
})
```

## MVP analysis scope

The server keeps the extraction narrow and evidence-first:

- homepage + up to 4 high-signal internal pages
- nav/link structure
- button / CTA presence
- background mode guess
- accent restraint heuristics
- basic typography signals
- page ordering hints such as hero, proof, features, pricing, CTA

## Output highlights

The JSON response stays compact and now includes:

- a human-readable `styleProfile`
- a small `styleProfile.reproduction` block for downstream implementation cues
- slim per-page `evidence.pageSignals` with page intent, primary CTA pattern, and top sections

It does **not** return raw heading/action/link arrays in the MCP output.

## Setup

```bash
npm install
npx playwright install chromium
```

## Scripts

```bash
npm run build
npm run typecheck
npm test
npm run test:mcp-cli
npm run test:e2e -- --instance figma-framer-webflow
npm start
```

`npm start` runs the built MCP server over stdio, so keep stdout reserved for protocol traffic.

## Local development

```bash
npm run dev
```

## Example MCP server entry

After building, the server entrypoint is:

```bash
node dist/src/index.js
```

## Repeatable MCP CLI test

Run the built server through MCP Inspector CLI with the default Apple + Pixel cross-site case:

```bash
npm run test:mcp-cli
```

Or pass your own public URLs:

```bash
bash scripts/test-mcp-cli.sh https://www.apple.com/ca/store https://store.google.com/category/phones?hl=en-GB&pli=1
```

The script builds the server, invokes `analyze_website_style` over the real stdio MCP transport, writes the full MCP payload to `.tmp/mcp-payload-<timestamp>.json`, and prints that file path.

## Review-oriented E2E run

Run a full review workflow against a committed instance:

```bash
npm run test:e2e -- --instance figma-framer-webflow
```

This flow:

- calls the MCP and saves the payload into the instance artifact folder
- screenshots every analyzed source page with Playwright
- spawns a fresh `opencode` run to regenerate a standalone HTML page from the MCP payload
- saves that HTML and a screenshot of the regenerated result

Artifacts are written under:

```bash
test/e2e/instances/<instance>/artifacts/<timestamp>/
```

You can review `manifest.json`, `mcp-result.json`, `regenerated.html`, and the saved screenshots manually.

## Notes

- only public `http`/`https` URLs are accepted
- no auth, persistence, queueing, or web server is included
- no manual sleeps are used; Playwright auto-wait plus explicit load-state waits handle synchronization
