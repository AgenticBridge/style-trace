import { buildCapturedPages } from "./moduleSegmentation.js";
import type {
  BackgroundMode,
  ButtonEmphasis,
  ButtonRadius,
  ButtonSize,
  ContrastTendency,
  DerivedDesignSignals,
  HeaderCtaPattern,
  HeroCtaPattern,
  NavDensity,
  PageEvidence,
  PageSnapshot,
  PricingPresence,
  SiteDesignGrammar,
} from "../core/types.js";
import { buildDesignGrammar } from "./visualGrammar.js";

interface RgbColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function buildSiteAnalysisResult(snapshots: PageSnapshot[]): {
  pageEvidence: PageEvidence[];
  capturedPages: import("../core/types.js").CapturedPage[];
  signals: DerivedDesignSignals;
  designGrammar: SiteDesignGrammar;
} {
  const backgroundModes = snapshots.map((snapshot) => guessBackgroundMode(snapshot.bodyBackgroundColor));
  const contrastLevels = snapshots.map((snapshot) => guessContrast(snapshot.bodyBackgroundColor, snapshot.bodyTextColor));
  const accentColors = snapshots.flatMap((snapshot) => collectAccentBuckets(snapshot));
  const accentCount = countDistinct(accentColors);
  const paletteRestraint = accentCount <= 1 ? "restrained" : accentCount === 2 ? "moderate" : "varied";

  const headingSamples = snapshots.flatMap((snapshot) => snapshot.headings);
  const bodyFamilies = snapshots.map((snapshot) => normalizeFontLabel(snapshot.bodyFontFamily));
  const headingFamilies = headingSamples.map((heading) => normalizeFontLabel(heading.fontFamily));
  const headingSize = average(headingSamples.map((heading) => heading.fontSize));
  const bodySize = average(snapshots.map((snapshot) => snapshot.bodyFontSize));
  const scaleRatio = bodySize > 0 ? headingSize / bodySize : 0;

  const sectionOrders = snapshots.map((snapshot) => detectSectionOrder(snapshot));
  const mergedStructure = mergeOrderedPatterns(sectionOrders);
  const density = inferDensity(snapshots);
  const sectionRhythm = inferSectionRhythm(snapshots);
  const contentWidth = inferContentWidth(snapshots);

  const primaryActionStats = snapshots.map((snapshot) => summarizeButtons(snapshot));
  const navSummary = summarizeNavigation(snapshots, primaryActionStats.map((item) => item.headerPrimaryCount));
  const buttonSummary = summarizeButtonTreatment(primaryActionStats);
  const ctaPresence = summarizeCtaPresence(primaryActionStats);
  const footerSummary = summarizeFooter(snapshots);
  const navDensity = summarizeNavDensity(snapshots);
  const headerCtaPattern = summarizeHeaderCtaPattern(primaryActionStats);
  const heroHeadingScale = summarizeHeroHeadingScale(scaleRatio);
  const heroCtaPattern = summarizeHeroCtaPattern(primaryActionStats);
  const heroMediaStyle = summarizeHeroMediaStyle(snapshots);
  const proofNearTop = inferProofNearTop(snapshots);
  const buttonRadius = summarizeButtonRadius(primaryActionStats);
  const buttonEmphasis = summarizeButtonEmphasis(primaryActionStats);
  const buttonSize = summarizeButtonSize(primaryActionStats);
  const pricingPresence = summarizePricingPresence(snapshots, sectionOrders);
  const pageEvidence = snapshots.map((snapshot, index) => ({
    path: snapshot.path || (index === 0 ? "/" : new URL(snapshot.url).pathname || "/"),
    sectionOrder: (sectionOrders[index] ?? []).slice(0, 4),
    intent: classifyPageIntent(snapshot, index),
    heroCtaPattern: primaryActionStats[index]?.heroCtaPattern ?? "none",
  }));
  const capturedPages = buildCapturedPages(snapshots, pageEvidence);

  const signals: DerivedDesignSignals = {
    colors: {
      backgroundMode: summarizeBackgroundModes(backgroundModes),
      accentCount,
      contrast: mostCommon(contrastLevels) ?? "medium",
      paletteRestraint,
    },
    typography: {
      headingStyle: summarizeHeadingStyle(headingSamples, headingFamilies),
      bodyStyle: summarizeBodyStyle(bodyFamilies),
      scale: summarizeScale(scaleRatio),
      families: uniqueStrings([...headingFamilies, ...bodyFamilies]).slice(0, 4),
    },
    layout: {
      density,
      sectionRhythm,
      structure: mergedStructure,
      contentWidth,
    },
    imagery: {
      iconDensity: classifyPresence(average(snapshots.map((snapshot) => snapshot.imagerySignals.iconCount)), [3, 8]),
      photoPresence: classifyPresence(average(snapshots.map((snapshot) => snapshot.imagerySignals.photoLikeMediaCount)), [1, 4]),
      illustrationPresence: classifyPresence(average(snapshots.map((snapshot) => snapshot.imagerySignals.illustrationLikeCount)), [1, 3]),
      videoPresence: average(snapshots.map((snapshot) => snapshot.imagerySignals.videoCount)) >= 0.5 ? "present" : "none",
    },
    motion: {
      motionLevel: classifyMotionLevel(snapshots),
      stickyLevel: classifyStickyLevel(snapshots),
      hoverEmphasis: classifyHoverEmphasis(snapshots),
    },
    forms: {
      fieldStyle: mostCommon(snapshots.map((snapshot) => snapshot.formSignals.fieldStyle)) ?? "none",
    },
    components: {
      nav: navSummary,
      buttons: buttonSummary,
      ctaPresence,
      footer: footerSummary,
    },
    reproduction: {
      header: {
        navDensity,
        ctaPattern: headerCtaPattern,
      },
      hero: {
        headingScale: heroHeadingScale,
        ctaPattern: heroCtaPattern,
        mediaStyle: heroMediaStyle,
        proofNearTop,
      },
      buttons: {
        radius: buttonRadius,
        emphasis: buttonEmphasis,
        size: buttonSize,
      },
      commerce: {
        pricingPresence,
      },
    },
  };

  const designGrammar = buildDesignGrammar({
    snapshots,
    pageEvidence,
    capturedPages,
    signals,
  });

  return {
    pageEvidence,
    capturedPages,
    signals,
    designGrammar,
  };
}

function collectAccentBuckets(snapshot: PageSnapshot): string[] {
  return snapshot.actions.flatMap((action) => {
    const candidates = [action.backgroundColor, action.borderColor, action.textColor];
    return candidates.flatMap((candidate) => {
      const color = parseCssColor(candidate);
      if (!color || color.a === 0) {
        return [];
      }

      const saturation = colorSaturation(color);
      const luminance = relativeLuminance(color);
      if (saturation < 0.08 || (luminance > 0.92 || luminance < 0.08)) {
        return [];
      }

      return [bucketColor(color)];
    });
  });
}

function summarizeButtons(stats: PageSnapshot) {
  const primaryActions = stats.actions.filter((action) => isLikelyPrimaryAction(action));
  const primaryCount = primaryActions.length;
  const roundedValues = stats.actions.map((action) => action.borderRadius);
  const radiusMedian = median(roundedValues);
  const avgPaddingX = average(stats.actions.map((action) => action.paddingX));
  const avgPaddingY = average(stats.actions.map((action) => action.paddingY));
  const heroPrimaryCount = findSectionCandidate(stats, "hero")?.primaryActionCount ?? primaryActions.filter((action) => action.top <= 900).length;
  const headerPrimaryCount = primaryActions.filter(isLikelyHeaderAction).length;
  const heroCtaPattern = classifyHeroCtaPattern(heroPrimaryCount);

  return {
    primaryCount,
    headerPrimaryCount,
    heroPrimaryCount,
    shape: classifyButtonRadius(radiusMedian),
    emphasis: classifyButtonEmphasis(primaryCount),
    size: classifyButtonSize(avgPaddingX, avgPaddingY),
    heroCtaPattern,
  };
}

function summarizeNavDensity(snapshots: PageSnapshot[]): NavDensity {
  const navLinkCount = Math.round(average(snapshots.map((snapshot) => snapshot.navLinkTexts.length)));
  return navLinkCount <= 5 ? "minimal" : "expanded";
}

function summarizeHeaderCtaPattern(stats: Array<{ headerPrimaryCount: number }>): HeaderCtaPattern {
  const averagePrimary = average(stats.map((item) => item.headerPrimaryCount));
  if (averagePrimary >= 1.5) {
    return "multiple-primary";
  }
  if (averagePrimary >= 0.5) {
    return "single-primary";
  }
  return "none";
}

function summarizeHeroHeadingScale(scaleRatio: number): "compact" | "moderate" | "large" {
  if (scaleRatio >= 3.2) {
    return "large";
  }
  if (scaleRatio >= 2.4) {
    return "moderate";
  }
  return "compact";
}

function summarizeHeroMediaStyle(snapshots: PageSnapshot[]): "text-only" | "split-media" | "immersive-media" {
  const styles = snapshots.map((snapshot) => {
    const hero = findSectionCandidate(snapshot, "hero");
    if (!hero || hero.mediaCount === 0) {
      return "text-only" as const;
    }
    if (hero.largeMediaCount >= 2 || (hero.largeMediaCount >= 1 && hero.height >= 700)) {
      return "immersive-media" as const;
    }
    return "split-media" as const;
  });

  return mostCommon(styles) ?? "text-only";
}

function classifyPresence(value: number, thresholds: [number, number]): "low" | "medium" | "high" {
  if (value >= thresholds[1]) {
    return "high";
  }
  if (value >= thresholds[0]) {
    return "medium";
  }
  return "low";
}

function classifyMotionLevel(snapshots: PageSnapshot[]): "restrained" | "moderate" | "active" {
  const averageMotion = average(snapshots.map((snapshot) => snapshot.interactionSignals.animatedElementCount + snapshot.interactionSignals.transitionElementCount));
  if (averageMotion >= 12) {
    return "active";
  }
  if (averageMotion >= 4) {
    return "moderate";
  }
  return "restrained";
}

function classifyStickyLevel(snapshots: PageSnapshot[]): "none" | "light" | "strong" {
  const stickyCount = average(snapshots.map((snapshot) => snapshot.interactionSignals.stickyElementCount));
  if (stickyCount >= 2) {
    return "strong";
  }
  if (stickyCount >= 0.5) {
    return "light";
  }
  return "none";
}

function classifyHoverEmphasis(snapshots: PageSnapshot[]): "subtle" | "clear" | "strong" {
  const hoverableActions = average(snapshots.map((snapshot) => snapshot.interactionSignals.hoverableActionCount));
  if (hoverableActions >= 4) {
    return "strong";
  }
  if (hoverableActions >= 1.5) {
    return "clear";
  }
  return "subtle";
}

function summarizeHeroCtaPattern(stats: Array<{ heroCtaPattern: HeroCtaPattern }>): HeroCtaPattern {
  return mostCommon(stats.map((item) => item.heroCtaPattern)) ?? "none";
}

function inferProofNearTop(snapshots: PageSnapshot[]): boolean {
  return snapshots.some((snapshot) => snapshot.sectionCandidates.some((item) => item.labels.includes("proof") && item.top <= 1800));
}

function summarizeButtonRadius(stats: Array<{ shape: ButtonRadius }>): ButtonRadius {
  return mostCommon(stats.map((item) => item.shape)) ?? "soft";
}

function summarizeButtonEmphasis(stats: Array<{ emphasis: ButtonEmphasis }>): ButtonEmphasis {
  return mostCommon(stats.map((item) => item.emphasis)) ?? "mixed";
}

function summarizeButtonSize(stats: Array<{ size: ButtonSize }>): ButtonSize {
  return mostCommon(stats.map((item) => item.size)) ?? "comfortable";
}

function summarizePricingPresence(snapshots: PageSnapshot[], sectionOrders: string[][]): PricingPresence {
  const hasPricingSection = sectionOrders.some((order) => order.includes("pricing"));
  const hasPricingPage = snapshots.some((snapshot) => /(pricing|plan|plans|shop|store|product|buy)/i.test(`${snapshot.path} ${snapshot.title}`));

  if (hasPricingSection && hasPricingPage) {
    return "section+page";
  }
  if (hasPricingPage) {
    return "page";
  }
  if (hasPricingSection) {
    return "section";
  }
  return "none";
}

function summarizeNavigation(snapshots: PageSnapshot[], primaryCounts: number[]): string {
  const navLinkCount = Math.round(average(snapshots.map((snapshot) => snapshot.navLinkTexts.length)));
  const headerActionCount = Math.round(average(snapshots.map((snapshot) => snapshot.actions.filter(isLikelyHeaderAction).length)));
  const primaryCtas = Math.round(average(primaryCounts));
  const ctaLabel = primaryCtas <= 1 ? "single primary CTA" : "multiple primary CTAs";
  const densityLabel = navLinkCount <= 5 ? "simple top nav" : "expanded top nav";
  const actionLabel = headerActionCount >= 4 ? ", action-heavy header" : "";
  return `${densityLabel} with ${ctaLabel}${actionLabel}`;
}

function summarizeButtonTreatment(stats: Array<{ primaryCount: number; shape: string }>): string {
  const averagePrimary = average(stats.map((item) => item.primaryCount));
  const commonShape = mostCommon(stats.map((item) => item.shape)) ?? "soft";
  const emphasis = averagePrimary >= 1 ? "solid primary" : "mixed emphasis";
  const shapeLabel = commonShape === "pill" ? "pill" : commonShape === "soft" ? "soft rounded" : "sharp";
  return `${shapeLabel}, ${emphasis}`;
}

function summarizeCtaPresence(stats: Array<{ primaryCount: number }>): string {
  const averagePrimary = average(stats.map((item) => item.primaryCount));
  if (averagePrimary >= 2) {
    return "repeated primary CTA across key sections";
  }
  if (averagePrimary >= 1) {
    return "single clear primary CTA per page";
  }
  return "CTA present but visually restrained";
}

function classifyPageIntent(snapshot: PageSnapshot, index: number): "home" | "pricing" | "product" | "company" | "proof" | "other" {
  const pathAndTitle = `${snapshot.path} ${snapshot.title}`.toLowerCase();
  const sections = detectSectionOrder(snapshot);
  if (index === 0 || snapshot.path === "/") {
    return "home";
  }

  const scores = new Map<"pricing" | "product" | "company" | "proof" | "other", number>([
    ["pricing", 0],
    ["product", 0],
    ["company", 0],
    ["proof", 0],
    ["other", 0],
  ]);

  addIntentScore(scores, "pricing", /(pricing|plan|plans|shop|store|buy|sales|quote|contact sales)/, pathAndTitle, 4);
  addIntentScore(scores, "product", /(product|products|category|categories|feature|platform|phone|phones|pixel|iphone|ipad|mac|watch|calendar|mail)/, pathAndTitle, 3);
  addIntentScore(scores, "company", /(about|company|business|enterprise|retail|team|story|careers|mission)/, pathAndTitle, 3);
  addIntentScore(scores, "proof", /(customer|customers|testimonial|case stud|stories|review|reviews|partners)/, pathAndTitle, 4);

  if (sections.includes("pricing")) {
    scores.set("pricing", (scores.get("pricing") ?? 0) + 3);
  }
  if (sections.includes("proof")) {
    scores.set("proof", (scores.get("proof") ?? 0) + 3);
  }
  if (sections.includes("features")) {
    scores.set("product", (scores.get("product") ?? 0) + 1);
  }
  if (sections.includes("hero") && sections.length <= 2) {
    scores.set("company", (scores.get("company") ?? 0) + 1);
  }

  const best = [...scores.entries()].sort((left, right) => right[1] - left[1])[0];
  return best && best[1] > 0 ? best[0] : "other";
}

function classifyHeroCtaPattern(topPrimaryCount: number): HeroCtaPattern {
  if (topPrimaryCount >= 3) {
    return "repeated";
  }
  if (topPrimaryCount === 2) {
    return "dual-cta";
  }
  if (topPrimaryCount === 1) {
    return "single-primary";
  }
  return "none";
}

function classifyButtonRadius(radiusMedian: number): ButtonRadius {
  if (radiusMedian >= 18) {
    return "pill";
  }
  if (radiusMedian >= 8) {
    return "soft";
  }
  return "sharp";
}

function classifyButtonEmphasis(primaryCount: number): ButtonEmphasis {
  if (primaryCount >= 2) {
    return "solid";
  }
  if (primaryCount >= 1) {
    return "mixed";
  }
  return "subtle";
}

function classifyButtonSize(avgPaddingX: number, avgPaddingY: number): ButtonSize {
  if (avgPaddingX >= 52 || avgPaddingY >= 18) {
    return "large";
  }
  if (avgPaddingX >= 28 || avgPaddingY >= 10) {
    return "comfortable";
  }
  return "compact";
}

function summarizeFooter(snapshots: PageSnapshot[]): string {
  const footerLinkCount = Math.round(average(snapshots.map((snapshot) => snapshot.footerLinkTexts.length)));
  return footerLinkCount >= 8 ? "multi-column footer with utility links" : "compact footer with essential links";
}

function detectSectionOrder(snapshot: PageSnapshot): string[] {
  const ordered = [...snapshot.sectionCandidates]
    .sort((left, right) => left.top - right.top)
    .flatMap((candidate) => candidate.labels);
  const uniqueOrdered = uniqueStrings(ordered).slice(0, 5);
  if (uniqueOrdered.length > 0) {
    return uniqueOrdered;
  }
  return inferFallbackSections(snapshot);
}

function mergeOrderedPatterns(patterns: string[][]): string[] {
  const counts = new Map<string, number>();
  for (const pattern of patterns) {
    for (const label of pattern) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([label]) => label)
    .slice(0, 5);
}

function inferDensity(snapshots: PageSnapshot[]): "airy" | "balanced" | "dense" {
  const ratios = snapshots.map((snapshot) => snapshot.textLength / Math.max(snapshot.pageHeight, 1));
  const averageRatio = average(ratios);
  if (averageRatio < 0.55) {
    return "airy";
  }
  if (averageRatio < 1) {
    return "balanced";
  }
  return "dense";
}

function inferSectionRhythm(snapshots: PageSnapshot[]): string {
  const gaps = snapshots.flatMap((snapshot) => {
    const positions = snapshot.sectionCandidates.map((candidate) => candidate.top).sort((left, right) => left - right);
    return positions.slice(1).map((position, index) => position - positions[index]!);
  });
  const spacing = median(gaps);
  if (spacing >= 650) {
    return "large vertical spacing";
  }
  if (spacing >= 380) {
    return "moderate vertical spacing";
  }
  return "tight vertical spacing";
}

function inferContentWidth(snapshots: PageSnapshot[]): string {
  const widths = snapshots.flatMap((snapshot) => snapshot.widthSamples);
  const medianWidth = median(widths);
  if (medianWidth >= 1200) {
    return "wide content container";
  }
  if (medianWidth >= 900) {
    return "standard marketing container";
  }
  return "compact content container";
}

function findSectionCandidate(snapshot: PageSnapshot, label: string) {
  return [...snapshot.sectionCandidates]
    .filter((candidate) => candidate.labels.includes(label))
    .sort((left, right) => left.top - right.top)[0];
}

function summarizeBackgroundModes(modes: BackgroundMode[]): BackgroundMode {
  const distinct = uniqueStrings(modes);
  return distinct.length > 1 ? "mixed" : (distinct[0] as BackgroundMode | undefined) ?? "light";
}

function guessBackgroundMode(colorValue: string): BackgroundMode {
  const color = parseCssColor(colorValue);
  if (!color) {
    return "light";
  }
  return relativeLuminance(color) < 0.35 ? "dark" : "light";
}

function guessContrast(backgroundValue: string, textValue: string): ContrastTendency {
  const background = parseCssColor(backgroundValue);
  const text = parseCssColor(textValue);
  if (!background || !text) {
    return "medium";
  }
  const ratio = contrastRatio(background, text);
  if (ratio >= 7) {
    return "high";
  }
  if (ratio >= 4.5) {
    return "medium";
  }
  return "low";
}

function addIntentScore(
  scores: Map<"pricing" | "product" | "company" | "proof" | "other", number>,
  intent: "pricing" | "product" | "company" | "proof",
  pattern: RegExp,
  value: string,
  amount: number,
): void {
  if (pattern.test(value)) {
    scores.set(intent, (scores.get(intent) ?? 0) + amount);
  }
}

function inferFallbackSections(snapshot: PageSnapshot): string[] {
  const sections: string[] = [];
  const topHeadings = snapshot.headings.filter((heading) => heading.top <= 900);
  const largestTopHeading = [...topHeadings].sort((left, right) => right.fontSize - left.fontSize)[0];
  const topPrimaryCount = snapshot.actions.filter((action) => action.top <= 900 && isLikelyPrimaryAction(action)).length;

  if (largestTopHeading || topPrimaryCount > 0) {
    sections.push("hero");
  }

  const text = `${snapshot.title} ${snapshot.headings.map((heading) => heading.text).join(" ")}`.toLowerCase();
  if (/(feature|capabilit|benefit|works with|built for|why )/.test(text)) {
    sections.push("features");
  }
  if (/(pricing|plans|plan|buy|purchase|sales)/.test(text)) {
    sections.push("pricing");
  }
  if (/(trusted|customer|testimonial|review|case stud|stories|partners)/.test(text)) {
    sections.push("proof");
  }
  if (topPrimaryCount >= 1 || /(get started|book demo|start free|talk to sales|contact sales|request demo)/.test(text)) {
    sections.push("cta");
  }

  return uniqueStrings(sections).slice(0, 5);
}

function isLikelyPrimaryAction(action: PageSnapshot["actions"][number]): boolean {
  const background = parseCssColor(action.backgroundColor);
  const text = action.text.toLowerCase();
  const buttonLikeText = /(get started|book demo|start free|talk to sales|request demo|buy|shop|learn more|contact sales|pre-order|try|sign up)/.test(text);
  const buttonLikeShape = action.paddingX >= 20 && action.paddingY >= 8;
  if (background && background.a > 0 && colorSaturation(background) >= 0.08 && buttonLikeShape) {
    return true;
  }
  return buttonLikeText && buttonLikeShape;
}

function isLikelyHeaderAction(action: PageSnapshot["actions"][number]): boolean {
  if (!(action.region === "header" || action.region === "nav")) {
    return false;
  }
  const text = action.text.toLowerCase();
  const shortText = text.length > 0 && text.length <= 24;
  return shortText && isLikelyPrimaryAction(action);
}

function summarizeHeadingStyle(headings: PageSnapshot["headings"], headingFamilies: string[]): string {
  const averageWeight = average(headings.map((heading) => heading.fontWeight));
  const family = mostCommon(headingFamilies) ?? "sans";
  return `${averageWeight >= 650 ? "bold" : "medium"} ${family}`;
}

function summarizeBodyStyle(bodyFamilies: string[]): string {
  const family = mostCommon(bodyFamilies) ?? "sans";
  return `neutral ${family}`;
}

function summarizeScale(scaleRatio: number): string {
  if (scaleRatio >= 3.2) {
    return "large hero, standard body";
  }
  if (scaleRatio >= 2.4) {
    return "moderate hero, standard body";
  }
  return "compact heading scale";
}

function normalizeFontLabel(rawFamily: string): string {
  const family = rawFamily.toLowerCase();
  if (family.includes("serif")) {
    return "serif";
  }
  if (family.includes("mono")) {
    return "mono";
  }
  return "sans";
}

function parseCssColor(value: string): RgbColor | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "transparent") {
    return null;
  }

  const rgbMatch = normalized.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    const parts = rgbMatch[1]?.split(",").map((part) => part.trim()) ?? [];
    const [r, g, b, a = "1"] = parts;
    if ([r, g, b].some((part) => part === undefined)) {
      return null;
    }
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
  }

  const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1] ?? "";
    if (hex.length === 3) {
      const expanded = hex.split("").map((char) => Number.parseInt(char + char, 16));
      const r = expanded[0] ?? 0;
      const g = expanded[1] ?? 0;
      const b = expanded[2] ?? 0;
      return { r, g, b, a: 1 };
    }

    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  return null;
}

function relativeLuminance(color: RgbColor): number {
  const transform = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const r = transform(color.r);
  const g = transform(color.g);
  const b = transform(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(first: RgbColor, second: RgbColor): number {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function colorSaturation(color: RgbColor): number {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) {
    return 0;
  }

  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function bucketColor(color: RgbColor): string {
  const bucket = (value: number) => Math.round(value / 24) * 24;
  return `${bucket(color.r)}-${bucket(color.g)}-${bucket(color.b)}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function mostCommon<T extends string>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function countDistinct(values: string[]): number {
  return new Set(values).size;
}
