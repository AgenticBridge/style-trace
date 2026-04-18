import { z } from "zod";

export const inputSchema = z.object({
  urls: z.array(z.string()).min(1, "Provide at least one URL.").max(10, "Provide at most 10 URLs.")
    .describe("One or more exact public http/https URLs to analyze. StyleTrace analyzes only the URLs you provide and does not crawl additional pages automatically."),
  evidenceMode: z.enum(["omit", "file", "inline"]).optional()
    .describe("How evidence should be returned. Defaults to omit. Use file to export evidence to a sidecar JSON instead of embedding it in structuredContent."),
}).strict();

const pageEvidenceSchema = z.object({
  path: z.string(),
  sectionOrder: z.array(z.string()),
  intent: z.enum(["home", "pricing", "product", "company", "proof", "other"]),
  heroCtaPattern: z.enum(["none", "single-primary", "dual-cta", "repeated"]),
});

const visualModuleSchema = z.object({
  kind: z.enum(["hero", "features", "pricing", "proof", "cta", "comparison", "promo", "navigation", "footer", "content"]),
  top: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  emphasis: z.enum(["low", "medium", "high"]),
  heading: z.string(),
  evidenceLabels: z.array(z.string()),
  hasPrimaryAction: z.boolean(),
  mediaWeight: z.enum(["none", "supporting", "dominant"]),
  cardDensity: z.enum(["none", "light", "heavy"]),
  visualProfile: z.object({
    alignment: z.enum(["left-led", "centered", "split", "mixed"]),
    balance: z.enum(["copy-led", "balanced", "media-led"]),
    surfaceStyle: z.enum(["flat", "panel", "mixed"]),
    whitespace: z.enum(["tight", "moderate", "open"]),
    backgroundMode: z.enum(["light", "dark", "mixed"]),
    viewportCoverage: z.number().min(0).max(1),
  }),
});

const visualCaptureSchema = z.object({
  kind: z.enum(["full-page", "hero", "section"]),
  label: z.string(),
  moduleKind: z.enum(["hero", "features", "pricing", "proof", "cta", "comparison", "promo", "navigation", "footer", "content"]).optional(),
  path: z.string(),
  clip: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});

const siteMotifSchema = z.object({
  label: z.string(),
  rationale: z.string(),
  evidencePaths: z.array(z.string()).optional(),
  strength: z.enum(["signature", "supporting"]),
});

const designAspectSchema = z.object({
  summary: z.string(),
  observations: z.array(z.string()),
  evidencePaths: z.array(z.string()).optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const outputSchema = z.object({
  sites: z.array(
    z.object({
      url: z.url(),
      pagesAnalyzed: z.array(z.string()),
      pageEvidence: z.array(pageEvidenceSchema).optional(),
      capturedPages: z.array(
        z.object({
          path: z.string(),
          intent: z.enum(["home", "pricing", "product", "company", "proof", "other"]),
          heroCtaPattern: z.enum(["none", "single-primary", "dual-cta", "repeated"]),
          viewport: z.object({
            width: z.number().int().positive(),
            height: z.number().int().positive(),
          }),
          moduleSequence: z.array(z.enum(["hero", "features", "pricing", "proof", "cta", "comparison", "promo", "navigation", "footer", "content"])),
          modules: z.array(visualModuleSchema),
          visualSignals: z.object({
            heroDominance: z.number().min(0),
            chromeVisibility: z.enum(["low", "medium", "high"]),
            visualRhythm: z.enum(["editorial", "modular", "commerce"]),
          }),
          visualCaptures: z.array(visualCaptureSchema).optional(),
        }),
      ),
      designGrammar: z.object({
        model: z.literal("ten-aspect-v1"),
        visualHierarchy: designAspectSchema,
        typographyScale: designAspectSchema,
        colorArchitecture: designAspectSchema,
        gridAndSpacing: designAspectSchema,
        iconographyAndImagery: designAspectSchema,
        componentStates: designAspectSchema,
        navigationLogic: designAspectSchema,
        microInteractions: designAspectSchema,
        formAndInputDesign: designAspectSchema,
        responsiveBreakpoints: designAspectSchema,
        signatureMotifs: z.array(siteMotifSchema),
        reconstructionDirectives: z.array(z.string()),
      }),
    }),
  ),
  evidenceArtifactPath: z.string().optional(),
  synthesis: z.object({
    mode: z.literal("aspect-grammar"),
    sharedPatterns: z.array(z.object({
      aspect: z.enum([
        "visualHierarchy",
        "typographyScale",
        "colorArchitecture",
        "gridAndSpacing",
        "iconographyAndImagery",
        "componentStates",
        "navigationLogic",
        "microInteractions",
        "formAndInputDesign",
        "responsiveBreakpoints",
      ]),
      summary: z.string(),
    })),
    referenceSignatures: z.array(
      z.object({
        siteUrl: z.url(),
        summary: z.string(),
        strongestAspects: z.array(z.enum([
          "visualHierarchy",
          "typographyScale",
          "colorArchitecture",
          "gridAndSpacing",
          "iconographyAndImagery",
          "componentStates",
          "navigationLogic",
          "microInteractions",
          "formAndInputDesign",
          "responsiveBreakpoints",
        ])),
        motifs: z.array(z.string()),
        evidencePaths: z.array(z.string()).optional(),
      }),
    ),
    blendStrategy: z.object({
      headline: z.string(),
      directives: z.array(z.string()),
      avoid: z.array(z.string()),
    }),
  }),
  guideline: z.object({
    mode: z.literal("aspect-preserving-synthesis"),
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
