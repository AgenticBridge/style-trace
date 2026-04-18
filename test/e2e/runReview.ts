import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import type { StyleTraceResult } from "../../src/types.js";

interface ReviewInstance {
  label: string;
  urls: string[];
  maxPagesPerSite?: number;
  synthesisMode?: "single-site-profile" | "cross-site-commonality";
}

interface InspectorPayload {
  content?: Array<{ type?: string; text?: string }>;
  structuredContent?: StyleTraceResult;
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
    const regeneratedHtmlPath = path.join(artifactDir, "regenerated.html");
    const regeneratedScreenshotPath = path.join(artifactDir, "regenerated.png");
    await regenerateHtmlFromMcp(mcpResultPath, regeneratedHtmlPath);
    await captureLocalHtml(browser, regeneratedHtmlPath, regeneratedScreenshotPath);

    const manifest = {
      instance: {
        name: instanceName,
        label: instance.label,
        instanceJsonPath: path.relative(repoRoot, path.join(instanceDir, "instance.json")),
      },
      artifacts: {
        artifactDir,
        mcpResultPath,
        regeneratedHtmlPath,
        regeneratedScreenshotPath,
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
        STYLE_TRACE_MAX_PAGES: String(instance.maxPagesPerSite ?? 3),
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

async function regenerateHtmlFromMcp(mcpResultPath: string, htmlPath: string): Promise<void> {
  const prompt = [
    "You are generating a pure standalone HTML review artifact from an MCP result.",
    "Read the attached JSON file and produce exactly one self-contained HTML document.",
    "Requirements:",
    "- output only raw HTML, no markdown fences or explanation",
    "- no external assets or external scripts",
    "- inline CSS only",
    "- body should summarize the style family and present a plausible reconstructed landing page",
    "- preserve the main cues from the MCP response, including hero style, CTA pattern, proof style, pricing path, and module structure",
    "- keep it reviewable by a human from a static screenshot",
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
      "--",
      prompt,
    ],
    { cwd: repoRoot, captureStdout: true },
  );

  const html = extractLastTextEvent(stdout);
  if (!html.trim().toLowerCase().startsWith("<html") && !html.trim().toLowerCase().startsWith("<!doctype html")) {
    throw new Error("OpenCode regeneration did not return standalone HTML.");
  }

  await writeFile(htmlPath, html, "utf8");
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

function slugify(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "root";
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
