import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

interface Manifest {
  instance: {
    name: string;
    label: string;
    instanceJsonPath: string;
  };
  artifacts: {
    artifactDir: string;
    mcpResultPath: string;
    regeneratedHtmlPath: string;
    regeneratedScreenshotPath: string;
  };
  sourceCaptures: Array<{
    siteUrl: string;
    pagePath: string;
    pageUrl: string;
    screenshotPath: string;
  }>;
}

interface StyleTracePayload {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: {
    sites: Array<{
      url: string;
      pagesAnalyzed: string[];
      styleProfile: {
        tone: string[];
        reproduction: {
          header: { navDensity: string; ctaPattern: string };
          hero: { headingScale: string; ctaPattern: string; mediaStyle: string; proofNearTop: boolean };
          buttons: { radius: string; emphasis: string; size: string };
          commerce: { pricingPresence: string; proofPresence: string };
        };
      };
    }>;
    observedCommonalities: {
      visualTone: string[];
      layoutPatterns: string[];
      componentPatterns: string[];
    };
    guideline: {
      rules: Array<{ rule: string; confidence: string; evidenceCount: number }>;
    };
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const instanceName = readArg(args, "--instance") ?? "figma-framer-webflow";
  const explicitManifest = readArg(args, "--manifest");
  const manifestPath = explicitManifest ?? await ensureLatestManifest(instanceName);
  const manifest = await readJson<Manifest>(manifestPath);
  const payload = await readJson<StyleTracePayload>(manifest.artifacts.mcpResultPath);
  const structured = payload.structuredContent;
  if (!structured) {
    throw new Error(`No structuredContent found in ${manifest.artifacts.mcpResultPath}`);
  }

  const promoDir = path.join(repoRoot, "docs", "promo");
  await mkdir(promoDir, { recursive: true });

  const htmlPath = path.join(promoDir, "style-trace-promo.html");
  const imagePath = path.join(promoDir, "style-trace-promo.png");
  const heroImagePath = path.join(promoDir, "style-trace-hero.png");
  const videoDir = path.join(promoDir, ".video-temp");
  await mkdir(videoDir, { recursive: true });

  const html = renderPromoHtml(manifest, structured);
  await writeFile(htmlPath, html, "utf8");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: "load", timeout: 15_000 });
    await page.locator(".hero").screenshot({ path: heroImagePath, type: "png" });
    await page.screenshot({ path: imagePath, fullPage: true, type: "png" });
    await page.waitForTimeout(600);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(800);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(700);
    const video = page.video();
    await page.close();
    await context.close();

    if (video) {
      const recorded = await video.path();
      await copyFile(recorded, path.join(promoDir, "style-trace-promo.webm"));
    }
  } finally {
    await browser.close();
  }

  process.stdout.write(`${promoDir}\n`);
}

function renderPromoHtml(manifest: Manifest, payload: NonNullable<StyleTracePayload["structuredContent"]>): string {
  const sourceCards = manifest.sourceCaptures.slice(0, 3).map((capture) => {
    return `
      <figure class="capture-card">
        <img src="${pathToFileURL(capture.screenshotPath).toString()}" alt="${escapeHtml(capture.pageUrl)}" />
        <figcaption>${escapeHtml(capture.pageUrl)}</figcaption>
      </figure>`;
  }).join("");

  const siteChips = payload.sites.map((site) => `<span class="chip">${escapeHtml(site.url.replace(/^https?:\/\//, ""))}</span>`).join("");
  const commonalityChips = [
    ...payload.observedCommonalities.visualTone.slice(0, 3),
    ...payload.observedCommonalities.layoutPatterns.slice(0, 2),
  ].map((item) => `<span class="chip chip-soft">${escapeHtml(item)}</span>`).join("");

  const siteRows = payload.sites.map((site) => {
    const reproduction = site.styleProfile.reproduction;
    return `
      <div class="site-row">
        <div>
          <h3>${escapeHtml(site.url)}</h3>
          <p>${escapeHtml(site.pagesAnalyzed.join(", "))}</p>
        </div>
        <div class="site-metrics">
          <span>${escapeHtml(reproduction.hero.headingScale)} ${escapeHtml(reproduction.hero.mediaStyle)} hero</span>
          <span>${escapeHtml(reproduction.hero.ctaPattern)} CTA</span>
          <span>${escapeHtml(reproduction.commerce.pricingPresence)} pricing path</span>
        </div>
      </div>`;
  }).join("");

  const guidelines = payload.guideline.rules.slice(0, 5).map((rule) => `
    <li>
      <strong>${escapeHtml(rule.rule)}</strong>
      <span>${escapeHtml(rule.confidence)} confidence · evidence ${rule.evidenceCount}</span>
    </li>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StyleTrace Promo</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0f1117;
        --panel: #151925;
        --panel-soft: #1b2030;
        --text: #f6f7fb;
        --muted: #aeb6ca;
        --accent: #76a8ff;
        --line: rgba(255,255,255,0.08);
        --shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: radial-gradient(circle at top, rgba(118,168,255,0.15), transparent 28%), var(--bg);
        color: var(--text);
        font: 16px/1.5 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .shell { width: min(1240px, calc(100vw - 64px)); margin: 0 auto; }
      .nav {
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(18px);
        background: rgba(15, 17, 23, 0.78);
        border-bottom: 1px solid var(--line);
      }
      .nav .shell { display: flex; justify-content: space-between; align-items: center; padding: 18px 0; }
      .nav strong { letter-spacing: 0.02em; }
      .nav span { color: var(--muted); }
      .hero {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 32px;
        align-items: center;
        padding: 72px 0 48px;
        min-height: 760px;
      }
      .eyebrow { color: var(--accent); font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; }
      h1 { font-size: clamp(42px, 6vw, 74px); line-height: 0.98; margin: 12px 0 18px; max-width: 10ch; }
      .lede { color: var(--muted); font-size: 20px; max-width: 62ch; margin: 0 0 22px; }
      .chip-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 8px 14px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: rgba(255,255,255,0.04);
        color: var(--text);
        font-size: 13px;
      }
      .chip-soft { background: rgba(118,168,255,0.12); border-color: rgba(118,168,255,0.22); }
      .hero-note { color: var(--muted); max-width: 56ch; }
      .proof-board {
        position: relative;
        min-height: 560px;
      }
      .board-card {
        position: absolute;
        border: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
        border-radius: 22px;
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .board-card img { display: block; width: 100%; height: 100%; object-fit: cover; }
      .board-main { inset: 32px 0 0 64px; }
      .board-side { width: 240px; height: 240px; top: 0; right: 0; transform: rotate(6deg); }
      .board-code {
        left: 0;
        bottom: 24px;
        width: 280px;
        padding: 20px;
        background: var(--panel);
      }
      .code-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; }
      pre { margin: 12px 0 0; color: #dce4ff; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
      section { padding: 40px 0; }
      h2 { font-size: 32px; margin: 0 0 14px; }
      .section-intro { color: var(--muted); max-width: 72ch; margin: 0 0 24px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
        box-shadow: var(--shadow);
      }
      .capture-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
      .capture-card {
        margin: 0;
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid var(--line);
        background: var(--panel-soft);
      }
      .capture-card img { width: 100%; display: block; aspect-ratio: 4/3; object-fit: cover; }
      .capture-card figcaption { padding: 10px 12px; color: var(--muted); font-size: 12px; }
      .site-list { display: grid; gap: 14px; }
      .site-row {
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        padding: 18px 0;
        border-top: 1px solid var(--line);
      }
      .site-row:first-child { border-top: 0; padding-top: 0; }
      .site-row h3 { margin: 0 0 6px; font-size: 18px; }
      .site-row p { margin: 0; color: var(--muted); font-size: 14px; }
      .site-metrics { display: flex; flex-wrap: wrap; gap: 10px; justify-content: flex-start; align-content: flex-start; }
      .site-metrics span, .mini-stat {
        padding: 8px 12px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.03);
        font-size: 13px;
      }
      .timeline { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
      .timeline .panel { min-height: 170px; }
      ul.rule-list { margin: 0; padding-left: 18px; }
      ul.rule-list li { margin: 0 0 14px; }
      ul.rule-list span { display: block; color: var(--muted); font-size: 13px; margin-top: 4px; }
      .cta {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: center;
        padding: 24px 0 72px;
      }
      .cta .panel { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      @media (max-width: 1000px) {
        .hero, .site-row, .timeline, .grid, .capture-grid, .cta .panel { grid-template-columns: 1fr; display: grid; }
        .proof-board { min-height: 440px; }
        .board-main { inset: 36px 0 0 0; }
        .board-side { width: 180px; height: 180px; }
        .board-code { width: 220px; }
      }
    </style>
  </head>
  <body>
    <header class="nav">
      <div class="shell">
        <strong>StyleTrace</strong>
        <span>Evidence-first MCP style analysis for public sites</span>
      </div>
    </header>
    <main class="shell">
      <section class="hero">
        <div>
          <div class="eyebrow">One MCP tool, reviewable results</div>
          <h1>Trace a site’s visual patterns into MCP-ready evidence.</h1>
          <p class="lede">StyleTrace analyzes public marketing sites with Playwright and returns compact JSON, source captures, and a review-friendly reconstruction artifact.</p>
          <div class="chip-row">${siteChips}</div>
          <div class="chip-row"><span class="chip">1 MCP tool</span><span class="chip">Playwright-backed</span><span class="chip">public URLs only</span><span class="chip">JSON only</span></div>
          <p class="hero-note">This is not a website builder. It preserves repeated visual cues — layout, hero treatment, CTA patterns, proof modules, and pricing paths — in a form that agents and reviewers can actually reuse.</p>
        </div>
        <div class="proof-board">
          <div class="board-card board-main"><img src="${pathToFileURL(payloadImage(manifest.artifacts.regeneratedScreenshotPath)).toString()}" alt="Regenerated review artifact" /></div>
          <div class="board-card board-side"><img src="${pathToFileURL(payloadImage(manifest.sourceCaptures[0]?.screenshotPath ?? manifest.artifacts.regeneratedScreenshotPath)).toString()}" alt="Source capture" /></div>
          <div class="board-card board-code">
            <div class="code-label">Output excerpt</div>
            <pre>${escapeHtml(JSON.stringify({
              tone: payload.observedCommonalities.visualTone,
              layout: payload.observedCommonalities.layoutPatterns,
              rules: payload.guideline.rules.slice(0, 3).map((item) => item.rule),
            }, null, 2))}</pre>
          </div>
        </div>
      </section>

      <section>
        <h2>What a real run leaves behind</h2>
        <p class="section-intro">Every e2e review run creates a compact artifact folder you can inspect, diff, screenshot, or hand to another agent. The visuals below are built directly from the latest review instance.</p>
        <div class="grid">
          <div class="panel">
            <div class="eyebrow">Output excerpt</div>
            <pre>${escapeHtml(JSON.stringify({
              sites: payload.sites.map((site) => ({
                url: site.url,
                pages: site.pagesAnalyzed,
                reproduction: site.styleProfile.reproduction,
              })),
              rules: payload.guideline.rules.slice(0, 3),
            }, null, 2))}</pre>
          </div>
          <div class="panel">
            <div class="eyebrow">Shared cues</div>
            <div class="chip-row">${commonalityChips}</div>
            <div class="site-list">${siteRows}</div>
          </div>
          <div class="panel">
            <div class="eyebrow">Source captures</div>
            <div class="capture-grid">${sourceCards}</div>
          </div>
          <div class="panel">
            <div class="eyebrow">Implementation rules</div>
            <ul class="rule-list">${guidelines}</ul>
          </div>
        </div>
      </section>

      <section>
        <h2>What StyleTrace actually extracts</h2>
        <p class="section-intro">Not raw DOM dumps. Not vague inspiration. A compact, evidence-first profile tuned for implementation and review.</p>
        <div class="timeline">
          <div class="panel"><div class="eyebrow">Structure</div><h3>Pages + sections</h3><p>Tracks analyzed paths, page intent, and top-of-page section signals like hero, proof, features, pricing, and CTA.</p></div>
          <div class="panel"><div class="eyebrow">Style profile</div><h3>Tone, layout, components</h3><p>Summarizes nav density, button treatment, typography, content width, card usage, proof modules, and pricing block style.</p></div>
          <div class="panel"><div class="eyebrow">Reproduction cues</div><h3>Actionable patterns</h3><p>Captures hero media style, CTA pattern, button radius/emphasis, and commerce/proof presence for implementation reuse.</p></div>
          <div class="panel"><div class="eyebrow">Artifact flow</div><h3>Review-ready outputs</h3><p>Produces source captures, compact JSON, and a regenerated HTML review artifact for human inspection.</p></div>
        </div>
      </section>

      <section>
        <h2>How the review flow works</h2>
        <p class="section-intro">The promo assets are generated from the same review pipeline maintainers use when evaluating a real instance.</p>
        <div class="timeline">
          <div class="panel"><div class="eyebrow">1</div><h3>Run the MCP</h3><p>Call <code>analyze_website_style</code> on public URLs and save the payload.</p></div>
          <div class="panel"><div class="eyebrow">2</div><h3>Capture source pages</h3><p>Use Playwright to screenshot each analyzed page so reviewers can compare references directly.</p></div>
          <div class="panel"><div class="eyebrow">3</div><h3>Regenerate pure HTML</h3><p>Use the MCP output to produce a review-only standalone HTML page that reflects the extracted style family.</p></div>
          <div class="panel"><div class="eyebrow">4</div><h3>Review the artifact set</h3><p>Inspect <code>manifest.json</code>, the JSON result, the regenerated screenshot, and all source captures side by side.</p></div>
        </div>
      </section>

      <section class="cta">
        <div class="panel">
          <div>
            <div class="eyebrow">Try it</div>
            <h2>Use StyleTrace when you need a reviewable style signal, not a generative site builder.</h2>
            <p class="section-intro">Run an e2e review, inspect the artifact folder, and decide whether the cues are strong enough for your own downstream agent or implementation workflow.</p>
          </div>
          <div class="site-metrics">
            <span class="mini-stat"><code>npm run test:e2e -- --instance ${escapeHtml(manifest.instance.name)}</code></span>
            <span class="mini-stat"><code>${escapeHtml(path.relative(repoRoot, manifest.artifacts.artifactDir))}</code></span>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function payloadImage(value: string): string {
  return value;
}

function readArg(args: string[], name: string): string | undefined {
  const directIndex = args.findIndex((arg) => arg === name);
  if (directIndex >= 0 && args[directIndex + 1]) {
    return args[directIndex + 1];
  }
  const equalsArg = args.find((arg) => arg.startsWith(`${name}=`));
  return equalsArg ? equalsArg.slice(name.length + 1) : undefined;
}

async function ensureLatestManifest(instanceName: string): Promise<string> {
  try {
    return await findLatestManifest(instanceName);
  } catch {
    await runCommand("npm", ["run", "test:e2e", "--", "--instance", instanceName], {
      cwd: repoRoot,
      captureStdout: false,
    });
    return findLatestManifest(instanceName);
  }
}

async function findLatestManifest(instanceName: string): Promise<string> {
  const artifactsDir = path.join(repoRoot, "test", "e2e", "instances", instanceName, "artifacts");
  const entries = await readdir(artifactsDir, { withFileTypes: true });
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().at(-1);
  if (!latest) {
    throw new Error(`No artifact directories found for instance ${instanceName}. Run npm run test:e2e -- --instance ${instanceName} first.`);
  }
  return path.join(artifactsDir, latest, "manifest.json");
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
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
  const { spawn } = await import("node:child_process");
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
