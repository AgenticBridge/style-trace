import { z } from "zod";

export const inputSchema = z.object({
  urls: z.array(z.string()).min(1, "Provide at least one URL.").max(10, "Provide at most 10 URLs.")
    .describe("One or more public http/https URLs to analyze."),
  maxPagesPerSite: z.number().int().min(1).max(5).optional()
    .describe("Maximum total pages to analyze per site, including the homepage. The server selects high-signal internal pages automatically when pageSelectionMode is 'auto'. Capped at 5."),
  pageSelectionMode: z.enum(["auto", "homepage-only"]).optional()
    .describe("Use 'auto' to analyze the homepage plus selected internal pages, or 'homepage-only' to analyze only the homepage."),
  synthesisMode: z.enum(["single-site-profile", "cross-site-commonality"]).optional()
    .describe("Override synthesis behavior. Defaults to single-site-profile for 1 URL and cross-site-commonality for 2+ URLs."),
});

const pageEvidenceSchema = z.object({
  path: z.string(),
  sectionOrder: z.array(z.string()),
  intent: z.enum(["home", "pricing", "product", "company", "proof", "other"]),
  heroCtaPattern: z.enum(["none", "single-primary", "dual-cta", "repeated"]),
});

export const outputSchema = z.object({
  sites: z.array(
    z.object({
      url: z.url(),
      pagesAnalyzed: z.array(z.string()),
      pageEvidence: z.array(pageEvidenceSchema),
      styleProfile: z.object({
        tone: z.array(z.string()),
        colors: z.object({
          backgroundMode: z.enum(["light", "dark", "mixed"]),
          accentCount: z.number().int().nonnegative(),
          contrast: z.enum(["high", "medium", "low"]),
          paletteRestraint: z.enum(["restrained", "moderate", "varied"]),
        }),
        typography: z.object({
          headingStyle: z.string(),
          bodyStyle: z.string(),
          scale: z.string(),
          families: z.array(z.string()),
        }),
        layout: z.object({
          density: z.enum(["airy", "balanced", "dense"]),
          sectionRhythm: z.string(),
          structure: z.array(z.string()),
          contentWidth: z.string(),
        }),
        components: z.object({
          nav: z.string(),
          buttons: z.string(),
          ctaPresence: z.string(),
          cards: z.string(),
          pricingBlocks: z.string(),
          proof: z.string(),
          footer: z.string(),
        }),
        reproduction: z.object({
          header: z.object({
            navDensity: z.enum(["minimal", "expanded"]),
            ctaPattern: z.enum(["none", "single-primary", "multiple-primary"]),
          }),
          hero: z.object({
            headingScale: z.enum(["compact", "moderate", "large"]),
            ctaPattern: z.enum(["none", "single-primary", "dual-cta", "repeated"]),
            mediaStyle: z.enum(["text-only", "split-media", "immersive-media"]),
            proofNearTop: z.boolean(),
          }),
          buttons: z.object({
            radius: z.enum(["sharp", "soft", "pill"]),
            emphasis: z.enum(["subtle", "mixed", "solid"]),
            size: z.enum(["compact", "comfortable", "large"]),
          }),
          commerce: z.object({
            pricingPresence: z.enum(["none", "section", "page", "section+page"]),
            proofPresence: z.enum(["none", "supporting", "prominent"]),
          }),
        }),
      }),
    }),
  ),
  observedCommonalities: z.object({
    visualTone: z.array(z.string()),
    layoutPatterns: z.array(z.string()),
    componentPatterns: z.array(z.string()),
  }),
  guideline: z.object({
    mode: z.literal("unopinionated-synthesis"),
    rules: z.array(
      z.object({
        rule: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
        evidenceCount: z.number().int().nonnegative(),
      }),
    ),
    avoid: z.array(
      z.object({
        rule: z.string(),
        reason: z.string(),
      }),
    ),
  }),
});

export type InputPayload = z.infer<typeof inputSchema>;
export type OutputPayload = z.infer<typeof outputSchema>;
