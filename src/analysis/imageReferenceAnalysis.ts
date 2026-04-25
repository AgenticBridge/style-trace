import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Browser, Page } from "playwright";
import type { CapturedPage, DerivedDesignSignals, DesignAspect, ReferenceType, SiteDesignGrammar, SiteProfile, VisualCapture, VisualModule } from "../core/types.js";

export async function analyzeImageReference(browser: Browser, imageUrl: string, runId: string, sourceType: Extract<ReferenceType, "image" | "screenshot"> = "image"): Promise<SiteProfile> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  try {
    const page = await context.newPage();
    await loadImageReference(page, imageUrl);
    const imageBox = await page.locator("[data-style-trace-image]").boundingBox();
    if (!imageBox) {
      throw new Error(`Unable to capture image reference: ${imageUrl}`);
    }

    const screenshotDir = path.join(process.cwd(), ".tmp", "style-trace-captures", runId, slugifyReference(imageUrl), "image-reference");
    await mkdir(screenshotDir, { recursive: true });
    const fullPagePath = path.join(screenshotDir, "full-page.png");
    const heroPath = path.join(screenshotDir, "hero.png");

    await page.screenshot({ path: fullPagePath, fullPage: true });
    await page.screenshot({
      path: heroPath,
      clip: {
        x: Math.max(0, Math.floor(imageBox.x)),
        y: Math.max(0, Math.floor(imageBox.y)),
        width: Math.max(1, Math.floor(imageBox.width)),
        height: Math.max(1, Math.floor(imageBox.height)),
      },
    });

    const screenshotBuffer = await page.screenshot({
      clip: {
        x: Math.max(0, Math.floor(imageBox.x)),
        y: Math.max(0, Math.floor(imageBox.y)),
        width: Math.max(1, Math.floor(imageBox.width)),
        height: Math.max(1, Math.floor(imageBox.height)),
      },
    });

    const stats = await sampleImageStats(context.newPage.bind(context), screenshotBuffer.toString("base64"));
    const capturedPage = buildCapturedPage(imageBox, fullPagePath, heroPath);

    return buildImageReferenceProfile(imageUrl, stats, capturedPage, sourceType);
  } finally {
    await context.close();
  }
}

export function buildImageReferenceProfile(
  imageUrl: string,
  stats: ImageStats,
  capturedPage: CapturedPage,
  sourceType: Extract<ReferenceType, "image" | "screenshot"> = "image",
): SiteProfile {
  const derivedSignals = buildImageDerivedSignals(stats);
  return {
    url: imageUrl,
    sourceType,
    pagesAnalyzed: ["/image-reference"],
    pageEvidence: [
      {
        path: "/image-reference",
        sectionOrder: ["hero"],
        intent: "other",
        heroCtaPattern: "none",
      },
    ],
    capturedPages: [capturedPage],
    derivedSignals,
    designGrammar: buildImageDesignGrammar(imageUrl, stats, capturedPage),
  };
}

async function loadImageReference(page: Page, imageUrl: string): Promise<void> {
  await page.setContent(
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <style>
          :root { color-scheme: light; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 40px;
            background: #101215;
          }
          main {
            width: min(1280px, calc(100vw - 80px));
          }
          img {
            display: block;
            width: 100%;
            max-height: calc(100vh - 80px);
            object-fit: contain;
            margin: 0 auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
            border-radius: 20px;
            background: #fff;
          }
        </style>
      </head>
      <body>
        <main>
          <img data-style-trace-image alt="StyleTrace reference image" />
        </main>
      </body>
    </html>`,
  );

  await page.locator("[data-style-trace-image]").evaluate((element, src) => {
    element.setAttribute("src", src);
  }, imageUrl);

  await page.locator("[data-style-trace-image]").evaluate(async (element) => {
    await new Promise<void>((resolve, reject) => {
      if ((element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0) {
        resolve();
        return;
      }

      element.addEventListener("load", () => resolve(), { once: true });
      element.addEventListener("error", () => reject(new Error("Image failed to load.")), { once: true });
    });
  });
}

async function sampleImageStats(createPage: () => Promise<Page>, base64Png: string): Promise<ImageStats> {
  const page = await createPage();

  try {
    return await page.evaluate(async (encoded) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to decode screenshot."));
      });

      const canvas = document.createElement("canvas");
      const maxDimension = 256;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context unavailable.");
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      let totalLightness = 0;
      let totalSaturation = 0;
      let darkPixels = 0;
      let lightPixels = 0;
      let vividPixels = 0;
      let edgeCount = 0;
      let whitespacePixels = 0;
      const buckets = new Set<string>();
      let previousLumaRow: number[] = [];

      for (let y = 0; y < height; y += 1) {
        const currentLumaRow: number[] = [];
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const r = data[index] ?? 0;
          const g = data[index + 1] ?? 0;
          const b = data[index + 2] ?? 0;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const lightness = (max + min) / 510;
          const saturation = max === 0 ? 0 : (max - min) / max;
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          currentLumaRow.push(luma);

          totalLightness += lightness;
          totalSaturation += saturation;
          if (lightness < 0.2) {
            darkPixels += 1;
          }
          if (lightness > 0.82) {
            lightPixels += 1;
          }
          if (saturation > 0.55) {
            vividPixels += 1;
          }
          if (lightness > 0.94 && saturation < 0.08) {
            whitespacePixels += 1;
          }

          buckets.add(`${Math.round(r / 32)}-${Math.round(g / 32)}-${Math.round(b / 32)}`);

          const leftLuma = x > 0 ? (currentLumaRow[x - 1] ?? luma) : luma;
          const topLuma = y > 0 ? previousLumaRow[x] ?? luma : luma;
          if (Math.abs(luma - leftLuma) > 26 || Math.abs(luma - topLuma) > 26) {
            edgeCount += 1;
          }
        }
        previousLumaRow = currentLumaRow;
      }

      const pixelCount = Math.max(1, width * height);
      return {
        aspectRatio: image.naturalWidth / Math.max(1, image.naturalHeight),
        averageLightness: totalLightness / pixelCount,
        averageSaturation: totalSaturation / pixelCount,
        darkRatio: darkPixels / pixelCount,
        lightRatio: lightPixels / pixelCount,
        vividRatio: vividPixels / pixelCount,
        whitespaceRatio: whitespacePixels / pixelCount,
        edgeDensity: edgeCount / pixelCount,
        paletteBucketCount: buckets.size,
      };
    }, base64Png);
  } finally {
    await page.close();
  }
}

function buildCapturedPage(imageBox: ImageBox, fullPagePath: string, heroPath: string): CapturedPage {
  const module: VisualModule = {
    kind: "hero",
    top: 0,
    height: Math.max(1, Math.floor(imageBox.height)),
    emphasis: "high",
    heading: "Image reference",
    evidenceLabels: ["image-reference"],
    hasPrimaryAction: false,
    mediaWeight: "dominant",
    cardDensity: "none",
    visualProfile: {
      alignment: "centered",
      balance: "media-led",
      surfaceStyle: "flat",
      whitespace: imageBox.width / Math.max(1, imageBox.height) > 1.2 ? "moderate" : "open",
      backgroundMode: "mixed",
      viewportCoverage: 1,
    },
  };

  const visualCaptures: VisualCapture[] = [
    {
      kind: "full-page",
      label: "Rendered image reference",
      path: fullPagePath,
      clip: {
        x: 0,
        y: 0,
        width: Math.max(1, Math.floor(imageBox.width)),
        height: Math.max(1, Math.floor(imageBox.height)),
      },
    },
    {
      kind: "hero",
      label: "Image crop",
      moduleKind: "hero",
      path: heroPath,
      clip: {
        x: 0,
        y: 0,
        width: Math.max(1, Math.floor(imageBox.width)),
        height: Math.max(1, Math.floor(imageBox.height)),
      },
    },
  ];

  return {
    path: "/image-reference",
    intent: "other",
    heroCtaPattern: "none",
    viewport: {
      width: Math.max(1, Math.floor(imageBox.width)),
      height: Math.max(1, Math.floor(imageBox.height)),
    },
    moduleSequence: ["hero"],
    modules: [module],
    visualSignals: {
      heroDominance: 1,
      chromeVisibility: "low",
      visualRhythm: "editorial",
    },
    visualCaptures,
  };
}

function buildImageDesignGrammar(imageUrl: string, stats: ImageStats, capturedPage: CapturedPage): SiteDesignGrammar {
  const evidencePaths = [imageUrl];
  const hierarchy = stats.edgeDensity > 0.18 ? "high-contrast focal structure" : "gentle single-frame composition";
  const paletteRestraint = stats.paletteBucketCount <= 18 ? "restrained" : stats.paletteBucketCount <= 32 ? "moderate" : "varied";
  const backgroundMode = stats.darkRatio > 0.55 ? "dark" : stats.lightRatio > 0.55 ? "light" : "mixed";
  const spacing = stats.whitespaceRatio > 0.3 ? "open framing" : stats.whitespaceRatio > 0.16 ? "moderate breathing room" : "tight crop";
  const imagerySummary = stats.vividRatio > 0.22 ? "color-led imagery" : "tonally restrained imagery";

  return {
    model: "ten-aspect-v1",
    visualHierarchy: buildAspect(
      `Image-led hierarchy with ${hierarchy} and a ${describeAspectRatio(stats.aspectRatio)} frame.`,
      [
        `Rendered frame ratio is ${stats.aspectRatio.toFixed(2)} with edge density ${(stats.edgeDensity * 100).toFixed(0)}%.`,
        `Whitespace ratio suggests ${spacing}.`,
      ],
      evidencePaths,
      "medium",
    ),
    typographyScale: buildAspect(
      "Typography cannot be inferred reliably from an image-only reference without legible text or DOM evidence.",
      [
        "Image references preserve overall visual tone better than text-scale detail.",
      ],
      evidencePaths,
      "low",
    ),
    colorArchitecture: buildAspect(
      `${paletteRestraint} palette on ${backgroundMode} surfaces with ${(stats.averageSaturation * 100).toFixed(0)}% average saturation.`,
      [
        `Palette bucket count is ${stats.paletteBucketCount}.`,
        `Dark-pixel ratio is ${(stats.darkRatio * 100).toFixed(0)}% and light-pixel ratio is ${(stats.lightRatio * 100).toFixed(0)}%.`,
      ],
      evidencePaths,
      "high",
    ),
    gridAndSpacing: buildAspect(
      `Composition reads as ${spacing} inside a ${describeAspectRatio(stats.aspectRatio)} container.`,
      [
        `Whitespace ratio is ${(stats.whitespaceRatio * 100).toFixed(0)}%.`,
        `The captured frame is ${capturedPage.viewport.width}x${capturedPage.viewport.height}.`,
      ],
      evidencePaths,
      "medium",
    ),
    iconographyAndImagery: buildAspect(
      `${imagerySummary} with ${stats.edgeDensity > 0.18 ? "sharper local detail" : "softer transitions"} across the frame.`,
      [
        `Vivid-color coverage is ${(stats.vividRatio * 100).toFixed(0)}%.`,
        `Edge density is ${(stats.edgeDensity * 100).toFixed(0)}%.`,
      ],
      evidencePaths,
      "high",
    ),
    componentStates: buildAspect(
      "Component-state behavior cannot be inferred from a standalone image reference.",
      [
        "No interactive controls were available for hover, pressed, or selected-state evidence.",
      ],
      evidencePaths,
      "low",
    ),
    navigationLogic: buildAspect(
      "Navigation structure cannot be inferred from a standalone image reference.",
      [
        "Image-only references do not expose page hierarchy or navigation affordances.",
      ],
      evidencePaths,
      "low",
    ),
    microInteractions: buildAspect(
      "Micro-interactions cannot be inferred from a static image reference.",
      [
        "Motion, hover transitions, and sticky behavior require live page evidence.",
      ],
      evidencePaths,
      "low",
    ),
    formAndInputDesign: buildAspect(
      "Form and input styling cannot be inferred reliably from a standalone image reference.",
      [
        "No field controls or form states were available to inspect.",
      ],
      evidencePaths,
      "low",
    ),
    responsiveBreakpoints: buildAspect(
      "Responsive behavior remains unknown for an image-only reference; preserve composition rather than inferring breakpoint rules.",
      [
        `Only a single rendered frame at ${capturedPage.viewport.width}x${capturedPage.viewport.height} was analyzed.`,
      ],
      evidencePaths,
      "low",
    ),
    signatureMotifs: [
      {
        label: `${paletteRestraint} ${backgroundMode} palette`,
        rationale: "The dominant palette and tonal balance are directly observable from the reference image.",
        evidencePaths,
        strength: "signature",
      },
      {
        label: `${spacing} around a ${describeAspectRatio(stats.aspectRatio)} image frame`,
        rationale: "The composition’s crop and negative space are stable visual cues worth preserving.",
        evidencePaths,
        strength: "supporting",
      },
      {
        label: imagerySummary,
        rationale: "Imagery treatment is the strongest reliable signal available from an image-only reference.",
        evidencePaths,
        strength: "signature",
      },
    ],
    reconstructionDirectives: [
      `Preserve the ${backgroundMode} tonal balance before adding new components.`,
      `Keep the ${spacing} and ${describeAspectRatio(stats.aspectRatio)} framing intact.`,
      `Use imagery treatment as a primary style driver; do not over-infer navigation, forms, or motion from this reference alone.`,
    ],
  };
}

function buildAspect(summary: string, observations: string[], evidencePaths: string[], confidence: DesignAspect["confidence"]): DesignAspect {
  return {
    summary,
    observations,
    evidencePaths,
    confidence,
  };
}

function describeAspectRatio(aspectRatio: number): string {
  if (aspectRatio >= 1.5) {
    return "landscape";
  }
  if (aspectRatio <= 0.8) {
    return "portrait";
  }
  return "balanced";
}

function slugifyReference(value: string): string {
  return value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "image-reference";
}

export interface ImageStats {
  aspectRatio: number;
  averageLightness: number;
  averageSaturation: number;
  darkRatio: number;
  lightRatio: number;
  vividRatio: number;
  whitespaceRatio: number;
  edgeDensity: number;
  paletteBucketCount: number;
}

interface ImageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function buildImageDerivedSignals(stats: ImageStats): DerivedDesignSignals {
  return {
    colors: {
      backgroundMode: stats.darkRatio > 0.55 ? "dark" : stats.lightRatio > 0.55 ? "light" : "mixed",
      accentCount: Math.max(1, Math.min(4, Math.round(stats.paletteBucketCount / 10))),
      contrast: stats.darkRatio > 0.5 || stats.lightRatio > 0.5 ? "high" : stats.averageLightness >= 0.35 && stats.averageLightness <= 0.7 ? "medium" : "low",
      paletteRestraint: stats.paletteBucketCount <= 18 ? "restrained" : stats.paletteBucketCount <= 32 ? "moderate" : "varied",
    },
    typography: {
      headingStyle: "unknown from image-only reference",
      bodyStyle: "unknown from image-only reference",
      scale: "unknown from image-only reference",
      families: [],
    },
    layout: {
      density: stats.whitespaceRatio > 0.3 ? "airy" : stats.whitespaceRatio > 0.16 ? "balanced" : "dense",
      sectionRhythm: stats.whitespaceRatio > 0.3 ? "open visual cadence" : "single-frame composition",
      structure: ["hero"],
      contentWidth: describeAspectRatio(stats.aspectRatio),
    },
    imagery: {
      iconDensity: "low",
      photoPresence: stats.edgeDensity > 0.18 ? "high" : "medium",
      illustrationPresence: stats.vividRatio > 0.22 ? "medium" : "low",
      videoPresence: "none",
    },
    motion: {
      motionLevel: "restrained",
      stickyLevel: "none",
      hoverEmphasis: "subtle",
    },
    forms: {
      fieldStyle: "none",
    },
    components: {
      nav: "unknown from image-only reference",
      buttons: "unknown from image-only reference",
      ctaPresence: "CTA presence cannot be inferred from a static image reference",
      footer: "unknown from image-only reference",
    },
    reproduction: {
      header: {
        navDensity: "minimal",
        ctaPattern: "none",
      },
      hero: {
        headingScale: "moderate",
        ctaPattern: "none",
        mediaStyle: stats.edgeDensity > 0.18 ? "immersive-media" : "split-media",
        proofNearTop: false,
      },
      buttons: {
        radius: "soft",
        emphasis: "mixed",
        size: "comfortable",
      },
      commerce: {
        pricingPresence: "none",
      },
    },
  };
}
