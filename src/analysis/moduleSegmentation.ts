import type {
  BackgroundMode,
  CapturedPage,
  HeroCtaPattern,
  ModuleKind,
  PageEvidence,
  PageSnapshot,
  SurfaceStyle,
  VisualAlignment,
  VisualBalance,
  VisualModule,
  Whitespace,
} from "../core/types.js";

export function buildCapturedPages(snapshots: PageSnapshot[], pageEvidence: PageEvidence[]): CapturedPage[] {
  return snapshots.map((snapshot, index) => {
    const evidence = pageEvidence[index];
    const modules = buildModules(snapshot);
    const hero = modules.find((module) => module.kind === "hero");
    return {
      path: evidence?.path ?? snapshot.path ?? "/",
      intent: evidence?.intent ?? "other",
      heroCtaPattern: evidence?.heroCtaPattern ?? "none",
      viewport: {
        width: snapshot.viewportWidth,
        height: snapshot.viewportHeight,
      },
      moduleSequence: uniqueKinds(modules.map((module) => module.kind)),
      modules,
      visualSignals: {
        heroDominance: Number(((hero?.visualProfile.viewportCoverage ?? 0) * (hero?.emphasis === "high" ? 1.25 : hero?.emphasis === "medium" ? 1 : 0.75)).toFixed(2)),
        chromeVisibility: snapshot.navLinkTexts.length >= 8 ? "high" : snapshot.navLinkTexts.length >= 4 ? "medium" : "low",
        visualRhythm: inferVisualRhythm(modules),
      },
    };
  });
}

function buildModules(snapshot: PageSnapshot): VisualModule[] {
  const modules = snapshot.sectionCandidates
    .slice()
    .sort((left, right) => left.top - right.top)
    .map((candidate, index) => {
      const labels = candidate.labels;
      const kind = classifyModuleKind(labels, candidate.headingText, index);
      const emphasis = candidate.top <= 900 || candidate.height >= 680 || candidate.largeMediaCount >= 2
        ? "high"
        : candidate.primaryActionCount > 0 || candidate.cardCount >= 4
          ? "medium"
          : "low";
      const mediaWeight = candidate.largeMediaCount >= 2 || (candidate.largeMediaCount >= 1 && candidate.height >= 700)
        ? "dominant"
        : candidate.mediaCount > 0
          ? "supporting"
          : "none";
      const cardDensity = candidate.cardCount >= 6 ? "heavy" : candidate.cardCount >= 2 ? "light" : "none";

      return {
        kind,
        top: Math.round(candidate.top),
        height: Math.round(candidate.height),
        emphasis,
        heading: candidate.headingText,
        evidenceLabels: labels,
        hasPrimaryAction: candidate.primaryActionCount > 0,
        mediaWeight,
        cardDensity,
        visualProfile: {
          alignment: inferAlignment(candidate),
          balance: inferBalance(candidate),
          surfaceStyle: inferSurfaceStyle(candidate),
          whitespace: inferWhitespace(candidate),
          backgroundMode: inferBackgroundMode(candidate.backgroundColor),
          viewportCoverage: candidate.viewportCoverage,
        },
      } satisfies VisualModule;
    });

  if (!modules.some((module) => module.kind === "navigation") && snapshot.navLinkTexts.length > 0) {
    modules.unshift({
      kind: "navigation",
      top: 0,
      height: 88,
      emphasis: snapshot.navLinkTexts.length > 6 ? "medium" : "low",
      heading: "Site navigation",
      evidenceLabels: ["navigation"],
      hasPrimaryAction: snapshot.actions.some((action) => action.region === "header" || action.region === "nav"),
      mediaWeight: "none",
      cardDensity: "none",
      visualProfile: {
        alignment: "split",
        balance: "copy-led",
        surfaceStyle: "flat",
        whitespace: "moderate",
        backgroundMode: inferBackgroundMode(snapshot.bodyBackgroundColor),
        viewportCoverage: 0.08,
      },
    });
  }

  if (!modules.some((module) => module.kind === "footer") && snapshot.footerLinkTexts.length > 0) {
    modules.push({
      kind: "footer",
      top: snapshot.pageHeight,
      height: 220,
      emphasis: "low",
      heading: "Footer",
      evidenceLabels: ["footer"],
      hasPrimaryAction: false,
      mediaWeight: "none",
      cardDensity: "none",
      visualProfile: {
        alignment: "mixed",
        balance: "copy-led",
        surfaceStyle: "mixed",
        whitespace: "moderate",
        backgroundMode: inferBackgroundMode(snapshot.bodyBackgroundColor),
        viewportCoverage: 0.12,
      },
    });
  }

  return modules;
}

function classifyModuleKind(labels: string[], heading: string, index: number): ModuleKind {
  const headingText = heading.toLowerCase();
  if (labels.includes("hero") || index === 0) {
    return "hero";
  }
  if (labels.includes("pricing")) {
    return labels.includes("features") ? "comparison" : "pricing";
  }
  if (labels.includes("proof")) {
    return "proof";
  }
  if (labels.includes("features")) {
    return "features";
  }
  if (labels.includes("cta")) {
    return "cta";
  }
  if (/compare|comparison|which model|why upgrade/.test(headingText)) {
    return "comparison";
  }
  if (/offer|deal|carrier|trade-?in|save|pre-?order/.test(headingText)) {
    return "promo";
  }
  return "content";
}

function uniqueKinds(values: ModuleKind[]): ModuleKind[] {
  return [...new Set(values)];
}

function inferAlignment(candidate: PageSnapshot["sectionCandidates"][number]): VisualAlignment {
  if (candidate.mediaAreaRatio >= 0.25 && candidate.centeredTextCount > 0 && candidate.leftAlignedTextCount > 0) {
    return "split";
  }
  if (candidate.centeredTextCount >= candidate.leftAlignedTextCount && candidate.centeredTextCount > 0) {
    return "centered";
  }
  if (candidate.leftAlignedTextCount > 0) {
    return "left-led";
  }
  return "mixed";
}

function inferBalance(candidate: PageSnapshot["sectionCandidates"][number]): VisualBalance {
  if (candidate.mediaAreaRatio >= 0.38 || candidate.largeMediaCount >= 2) {
    return "media-led";
  }
  if (candidate.mediaAreaRatio >= 0.16 || (candidate.mediaCount > 0 && candidate.textBlockCount > 0)) {
    return "balanced";
  }
  return "copy-led";
}

function inferSurfaceStyle(candidate: PageSnapshot["sectionCandidates"][number]): SurfaceStyle {
  if (candidate.cardCount >= 5) {
    return "panel";
  }
  if (candidate.cardCount >= 2 || candidate.backgroundColor !== "rgba(0, 0, 0, 0)") {
    return "mixed";
  }
  return "flat";
}

function inferWhitespace(candidate: PageSnapshot["sectionCandidates"][number]): Whitespace {
  const densityScore = candidate.textLength / Math.max(1, candidate.height);
  if (candidate.viewportCoverage >= 0.55 && densityScore < 0.45) {
    return "open";
  }
  if (densityScore >= 0.85 || candidate.cardCount >= 6) {
    return "tight";
  }
  return "moderate";
}

function inferBackgroundMode(color: string): BackgroundMode {
  const channels = color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [255, 255, 255];
  const luminance = (0.2126 * channels[0]!) + (0.7152 * channels[1]!) + (0.0722 * channels[2]!);
  if (luminance <= 96) {
    return "dark";
  }
  if (luminance >= 192) {
    return "light";
  }
  return "mixed";
}

function inferVisualRhythm(modules: VisualModule[]): "editorial" | "modular" | "commerce" {
  const cardHeavy = modules.filter((module) => module.cardDensity === "heavy").length;
  const commerceHeavy = modules.filter((module) => ["pricing", "promo", "comparison", "cta"].includes(module.kind)).length;
  if (commerceHeavy >= 2) {
    return "commerce";
  }
  if (cardHeavy >= 2) {
    return "modular";
  }
  return "editorial";
}

export function heroSignature(capturedPage: CapturedPage): {
  mediaWeight: VisualModule["mediaWeight"];
  emphasis: VisualModule["emphasis"];
  kind: ModuleKind;
} {
  const hero = capturedPage.modules.find((module) => module.kind === "hero");
  return {
    mediaWeight: hero?.mediaWeight ?? "none",
    emphasis: hero?.emphasis ?? "low",
    kind: hero?.kind ?? "content",
  };
}

export function ctaPressure(capturedPage: CapturedPage): HeroCtaPattern {
  return capturedPage.heroCtaPattern;
}
