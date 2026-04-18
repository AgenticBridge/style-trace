import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import type { StyleTraceResult } from "../../src/core/types.js";

interface ReviewInstance {
  label: string;
  urls: string[];
  synthesisMode?: "single-site-profile" | "cross-site-commonality";
}

interface InspectorPayload {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: StyleTraceResult;
}

interface EvidenceArtifact {
  sites: Array<{
    url: string;
    visualCaptures: Array<{
      pagePath: string;
      kind: "full-page" | "hero" | "section";
      moduleKind?: string;
      path: string;
    }>;
  }>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

async function main(): Promise<void> {
  const instanceName = readInstanceName(process.argv.slice(2));
  const instanceDir = path.join(repoRoot, "test", "e2e", "instances", instanceName);
  const instance = await readJson<ReviewInstance>(path.join(instanceDir, "instance.json"));
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const artifactDir = path.join(instanceDir, "artifacts", timestamp);
  const capturesDir = path.join(artifactDir, "captures");
  await mkdir(capturesDir, { recursive: true });

  const mcpResultPath = path.join(artifactDir, "mcp-result.json");
  const payload = await runMcp(instance, mcpResultPath);
  const result = payload.structuredContent;
  if (!result) {
    throw new Error(`MCP payload at ${mcpResultPath} did not include structuredContent.`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const sourceCaptures = await captureSourcePages(browser, result, capturesDir);
    const withMcpHtmlPath = path.join(artifactDir, "with-mcp.html");
    const withMcpScreenshotPath = path.join(artifactDir, "with-mcp.png");
    const withoutMcpHtmlPath = path.join(artifactDir, "without-mcp.html");
    const withoutMcpScreenshotPath = path.join(artifactDir, "without-mcp.png");
    const diffBoardHtmlPath = path.join(artifactDir, "diff-board.html");
    const diffBoardScreenshotPath = path.join(artifactDir, "diff-board.png");
    const evidenceArtifact = result.evidenceArtifactPath ? await readJson<EvidenceArtifact>(result.evidenceArtifactPath) : undefined;

    await writeFile(withMcpHtmlPath, await regenerateHtmlFromMcp(mcpResultPath, collectVisualCapturePaths(evidenceArtifact)), "utf8");
    await writeFile(withoutMcpHtmlPath, await regenerateHtmlWithoutMcp(instance.urls), "utf8");
    await captureLocalHtml(browser, withMcpHtmlPath, withMcpScreenshotPath);
    await captureLocalHtml(browser, withoutMcpHtmlPath, withoutMcpScreenshotPath);
    await writeFile(diffBoardHtmlPath, renderDiffBoard(instance, sourceCaptures, {
      withMcpScreenshotPath,
      withoutMcpScreenshotPath,
    }), "utf8");
    await captureLocalHtml(browser, diffBoardHtmlPath, diffBoardScreenshotPath);

    const manifest = {
      instance: {
        name: instanceName,
        label: instance.label,
        instanceJsonPath: path.relative(repoRoot, path.join(instanceDir, "instance.json")),
      },
      artifacts: {
        artifactDir,
        mcpResultPath,
        regeneratedHtmlPath: withMcpHtmlPath,
        regeneratedScreenshotPath: withMcpScreenshotPath,
        withMcpHtmlPath,
        withMcpScreenshotPath,
        withoutMcpHtmlPath,
        withoutMcpScreenshotPath,
        diffBoardHtmlPath,
        diffBoardScreenshotPath,
      },
      sourceCaptures,
    };

    const manifestPath = path.join(artifactDir, "manifest.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    process.stdout.write(`${manifestPath}\n`);
  } finally {
    await browser.close();
  }
}

function readInstanceName(args: string[]): string {
  const instanceFlagIndex = args.findIndex((arg) => arg === "--instance");
  if (instanceFlagIndex >= 0 && args[instanceFlagIndex + 1]) {
    return args[instanceFlagIndex + 1]!;
  }

  const equalsArg = args.find((arg) => arg.startsWith("--instance="));
  if (equalsArg) {
    return equalsArg.slice("--instance=".length);
  }

  throw new Error("Missing --instance <name> for test:e2e.");
}

async function runMcp(instance: ReviewInstance, outputPath: string): Promise<InspectorPayload> {
  await runCommand(
    "bash",
    [path.join(repoRoot, "scripts", "test-mcp-cli.sh"), ...instance.urls],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        STYLE_TRACE_OUTPUT_PATH: outputPath,
        STYLE_TRACE_EVIDENCE_MODE: "file",
      },
      captureStdout: false,
    },
  );

  return readJson<InspectorPayload>(outputPath);
}

async function captureSourcePages(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  result: StyleTraceResult,
  capturesDir: string,
): Promise<Array<{ siteUrl: string; pagePath: string; pageUrl: string; screenshotPath: string }>> {
  const captures: Array<{ siteUrl: string; pagePath: string; pageUrl: string; screenshotPath: string }> = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    for (const site of result.sites) {
      const siteDir = path.join(capturesDir, slugify(site.url));
      await mkdir(siteDir, { recursive: true });

      for (const pagePath of site.pagesAnalyzed) {
        const pageUrl = new URL(pagePath, site.url).toString();
        const page = await context.newPage();
        const screenshotPath = path.join(siteDir, `${slugify(pagePath || "/")}.png`);
        try {
          await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
          await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
          await page.waitForTimeout(1500);
          await page.screenshot({ path: screenshotPath, fullPage: true, type: "png" });
          captures.push({ siteUrl: site.url, pagePath, pageUrl, screenshotPath });
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await context.close();
  }

  return captures;
}

async function regenerateHtmlFromMcp(mcpResultPath: string, visualCapturePaths: string[]): Promise<string> {
  const prompt = [
    "You are generating a pure standalone HTML review artifact from a StyleTrace MCP result.",
    "Read the attached JSON file and produce exactly one self-contained HTML document.",
    "Goal:",
    "- visibly reflect the extracted design grammar and signature motifs",
    "- preserve differences implied by the MCP result instead of averaging them away",
    "- if the MCP suggests restraint, whitespace, product-led hero, or disciplined chrome, the HTML must visibly show that",
    "Requirements:",
    "- output only raw HTML, no markdown fences or explanation",
    "- no external assets or external scripts",
    "- inline CSS only",
    "- make it screenshot-reviewable",
    "- include a hero, 2-4 body sections, and optional pricing if the MCP output supports it",
    "- do not add generic gradient-heavy tech styling unless the MCP explicitly supports it",
  ].join("\n");

  const stdout = await runCommand(
    "opencode",
    [
      "run",
      "--pure",
      "--format",
      "json",
      "--dir",
      repoRoot,
      "--file",
      mcpResultPath,
      ...visualCapturePaths.flatMap((filePath) => ["--file", filePath]),
      "--",
      prompt,
    ],
    { cwd: repoRoot, captureStdout: true },
  );

  const html = extractLastTextEvent(stdout);
  if (!html.trim().toLowerCase().startsWith("<html") && !html.trim().toLowerCase().startsWith("<!doctype html")) {
    throw new Error("OpenCode regeneration did not return standalone HTML.");
  }

  return html;
}

async function regenerateHtmlWithoutMcp(sourceUrls: string[]): Promise<string> {
  const prompt = [
    "Generate exactly one standalone HTML landing page from this reference set.",
    "This is the baseline condition with no structured StyleTrace analysis.",
    `Reference set: ${sourceUrls.join(", ")}`,
    "Important:",
    "- do not assume any extracted design grammar or signature motifs",
    "- use only generic industry intuition from the reference set",
    "- output only raw HTML, no markdown fences or explanation",
    "- no external assets or external scripts",
    "- inline CSS only",
    "- make it screenshot-reviewable",
    "- include a hero, feature sections, and a conversion path",
  ].join("\n");

  const stdout = await runCommand(
    "opencode",
    [
      "run",
      "--pure",
      "--format",
      "json",
      "--dir",
      repoRoot,
      "--",
      prompt,
    ],
    { cwd: repoRoot, captureStdout: true },
  );

  const html = extractLastTextEvent(stdout);
  if (!html.trim().toLowerCase().startsWith("<html") && !html.trim().toLowerCase().startsWith("<!doctype html")) {
    throw new Error("OpenCode baseline generation did not return standalone HTML.");
  }

  return html;
}

async function captureLocalHtml(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  htmlPath: string,
  screenshotPath: string,
): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await context.newPage();
    try {
      await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: "load", timeout: 15_000 });
      await page.screenshot({ path: screenshotPath, fullPage: true, type: "png" });
    } finally {
      await page.close();
    }
  } finally {
    await context.close();
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function extractLastTextEvent(stdout: string): string {
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const textEvents = lines.flatMap((line) => {
    try {
      const event = JSON.parse(line) as { type?: string; part?: { text?: string } };
      return event.type === "text" && event.part?.text ? [event.part.text] : [];
    } catch {
      return [];
    }
  });

  const finalText = textEvents.at(-1);
  if (!finalText) {
    throw new Error("Could not extract final HTML text from opencode output.");
  }

  return finalText;
}

function collectVisualCapturePaths(evidenceArtifact: EvidenceArtifact | undefined): string[] {
  if (!evidenceArtifact) {
    return [];
  }

  return evidenceArtifact.sites
    .flatMap((site) => site.visualCaptures)
    .flatMap((capture) => capture.kind === "hero" || capture.kind === "section" ? [capture.path] : []);
}

function slugify(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "root";
}

function renderDiffBoard(
  instance: ReviewInstance,
  sourceCaptures: Array<{ siteUrl: string; pagePath: string; pageUrl: string; screenshotPath: string }>,
  generated: {
    withMcpScreenshotPath: string;
    withoutMcpScreenshotPath: string;
  },
): string {
  const referenceCards = sourceCaptures.slice(0, 3).map((capture) => imageCard({
    title: new URL(capture.siteUrl).hostname.replace(/^www\./, ""),
    subtitle: capture.pageUrl,
    imagePath: capture.screenshotPath,
    tone: "reference",
  })).join("");

  const comparisonItems: Array<{ title: string; subtitle: string; imagePath: string; tone: "with-mcp" | "without-mcp" }> = [
    {
      title: "Generated With MCP",
      subtitle: "LLM regeneration from fresh StyleTrace JSON",
      imagePath: generated.withMcpScreenshotPath,
      tone: "with-mcp",
    },
    {
      title: "Generated Without MCP",
      subtitle: "LLM baseline with no structured StyleTrace payload",
      imagePath: generated.withoutMcpScreenshotPath,
      tone: "without-mcp",
    },
  ];
  const comparisonCards = comparisonItems.map((card) => imageCard(card)).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(instance.label)} diff board</title>
    <style>
      :root {
        --bg: #0f131a;
        --panel: #171d27;
        --line: rgba(255,255,255,0.08);
        --text: #edf2f7;
        --muted: #a9b5c4;
        --reference: #5c7ea7;
        --with: #327a64;
        --without: #a55245;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(92,126,167,0.18), transparent 28%),
          radial-gradient(circle at top right, rgba(50,122,100,0.12), transparent 22%),
          linear-gradient(180deg, #0b0f15, #121926);
        font: 16px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
      }
      .shell { width: min(1560px, calc(100vw - 48px)); margin: 0 auto; padding: 28px 0 40px; }
      .hero {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 24px;
        align-items: end;
        padding-bottom: 24px;
      }
      .eyebrow {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: #8cb0e0;
      }
      h1 {
        margin: 10px 0 12px;
        font-size: clamp(38px, 5vw, 64px);
        line-height: 0.98;
        max-width: 11ch;
      }
      .lede, .summary li { color: var(--muted); }
      .summary {
        padding: 20px;
        border-radius: 24px;
        background: rgba(255,255,255,0.03);
        border: 1px solid var(--line);
      }
      .summary ul { margin: 0; padding-left: 18px; }
      .section-label {
        margin: 24px 0 12px;
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .ref-grid, .compare-grid {
        display: grid;
        gap: 16px;
      }
      .ref-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .compare-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .card {
        overflow: hidden;
        border-radius: 24px;
        background: var(--panel);
        border: 1px solid var(--line);
        box-shadow: 0 24px 80px rgba(0,0,0,0.28);
      }
      .card-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: start;
        padding: 16px 18px;
        border-bottom: 1px solid var(--line);
      }
      .card-header h2 { margin: 0 0 4px; font-size: 20px; }
      .card-header p { margin: 0; color: var(--muted); font-size: 13px; word-break: break-word; }
      .badge {
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      .badge.reference { background: rgba(92,126,167,0.16); color: #b7c9e4; }
      .badge.with-mcp { background: rgba(50,122,100,0.18); color: #bde4d5; }
      .badge.without-mcp { background: rgba(165,82,69,0.18); color: #f0c0b7; }
      .image-frame {
        background: #0c1016;
        padding: 16px;
      }
      .image-frame img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.08);
      }
      @media (max-width: 1080px) {
        .hero, .ref-grid, .compare-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div>
          <div class="eyebrow">StyleTrace E2E Review</div>
          <h1>LLM-regenerated comparison, with and without MCP guidance.</h1>
          <p class="lede">This board exists to make MCP effectiveness inspectable. Both pages are regenerated from scratch by the LLM on every run. The only difference is whether the model receives the fresh StyleTrace JSON.</p>
        </div>
        <aside class="summary">
          <ul>
            <li>Top row: supplied reference pages only, with no hidden crawling.</li>
            <li>Bottom left: LLM output conditioned on the current MCP result.</li>
            <li>Bottom right: baseline LLM output without structured MCP guidance.</li>
          </ul>
        </aside>
      </section>
      <div class="section-label">Reference Pages</div>
      <section class="ref-grid">${referenceCards}</section>
      <div class="section-label">Generated Comparison</div>
      <section class="compare-grid">${comparisonCards}</section>
    </main>
  </body>
</html>`;
}

function imageCard(card: { title: string; subtitle: string; imagePath: string; tone: "reference" | "with-mcp" | "without-mcp" }): string {
  return `<article class="card">
    <div class="card-header">
      <div>
        <h2>${escapeHtml(card.title)}</h2>
        <p>${escapeHtml(card.subtitle)}</p>
      </div>
      <span class="badge ${card.tone}">${escapeHtml(card.tone.replace("-", " "))}</span>
    </div>
    <div class="image-frame">
      <img src="${pathToFileURL(card.imagePath).toString()}" alt="${escapeHtml(card.title)}" />
    </div>
  </article>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function runCommand(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; captureStdout: boolean },
): Promise<string> {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: options.captureStdout ? ["ignore", "pipe", "inherit"] : ["ignore", "inherit", "inherit"],
  });

  let stdout = "";
  if (options.captureStdout) {
    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${exitCode}.`);
  }

  return stdout;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
