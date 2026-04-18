import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { CapturedPage, PageSnapshot, VisualCapture } from "../core/types.js";

export async function captureVisualEvidence(input: {
  page: Page;
  snapshot: PageSnapshot;
  capturedPage: CapturedPage;
  siteUrl: string;
  runId: string;
}): Promise<VisualCapture[]> {
  const { page, snapshot, capturedPage, siteUrl, runId } = input;
  const outputDir = path.join(process.cwd(), ".tmp", "style-trace-captures", runId, slugify(siteUrl), slugify(snapshot.path || "root"));
  await mkdir(outputDir, { recursive: true });

  const captures: VisualCapture[] = [];
  const viewportWidth = snapshot.viewportWidth;
  const pageHeight = Math.max(snapshot.pageHeight, snapshot.viewportHeight);

  const fullPagePath = path.join(outputDir, "full-page.png");
  await page.screenshot({ path: fullPagePath, fullPage: true, type: "png" });
  captures.push({
    kind: "full-page",
    label: "Full page",
    path: fullPagePath,
    clip: {
      x: 0,
      y: 0,
      width: viewportWidth,
      height: pageHeight,
    },
  });

  const hero = capturedPage.modules.find((module) => module.kind === "hero");
  if (hero) {
    const heroCapture = await captureClip(page, {
      filePath: path.join(outputDir, "hero.png"),
      label: hero.heading || "Hero",
      kind: "hero",
      moduleKind: "hero",
      x: 0,
      y: hero.top,
      width: viewportWidth,
      height: Math.min(hero.height, Math.round(snapshot.viewportHeight * 1.25)),
      pageHeight,
    });
    if (heroCapture) {
      captures.push(heroCapture);
    }
  }

  const sectionModules = capturedPage.modules
    .filter((module) => !["navigation", "footer", "hero"].includes(module.kind))
    .slice(0, 3);
  for (const [index, module] of sectionModules.entries()) {
    const sectionCapture = await captureClip(page, {
      filePath: path.join(outputDir, `section-${index + 1}-${module.kind}.png`),
      label: module.heading || `${module.kind} section`,
      kind: "section",
      moduleKind: module.kind,
      x: 0,
      y: module.top,
      width: viewportWidth,
      height: Math.min(module.height, snapshot.viewportHeight),
      pageHeight,
    });
    if (sectionCapture) {
      captures.push(sectionCapture);
    }
  }

  return captures;
}

async function captureClip(
  page: Page,
  input: {
    filePath: string;
    label: string;
    kind: VisualCapture["kind"];
    moduleKind?: VisualCapture["moduleKind"];
    x: number;
    y: number;
    width: number;
    height: number;
    pageHeight: number;
  },
): Promise<VisualCapture | null> {
  const clip = normalizeClip(input);
  if (!clip) {
    return null;
  }

  try {
    await page.screenshot({
      path: input.filePath,
      clip,
      type: "png",
    });
  } catch {
    return null;
  }

  return {
    kind: input.kind,
    label: input.label,
    path: input.filePath,
    clip,
    ...(input.moduleKind ? { moduleKind: input.moduleKind } : {}),
  };
}

function normalizeClip(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  pageHeight: number;
}): VisualCapture["clip"] | null {
  const x = Math.max(0, Math.round(input.x));
  const y = Math.max(0, Math.round(input.y));
  const width = Math.max(320, Math.round(input.width));
  const maxHeight = Math.max(1, input.pageHeight - y);
  const height = Math.max(120, Math.min(Math.round(input.height), maxHeight));
  if (maxHeight <= 0) {
    return null;
  }

  return { x, y, width, height };
}

function slugify(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "root";
}
