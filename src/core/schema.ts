import { z } from "zod";

const referenceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url"),
    value: z.string().describe("Exact public http/https URL to analyze as a website reference."),
  }),
  z.object({
    type: z.literal("image"),
    value: z.string().describe("Exact public http/https image URL to analyze as a visual reference."),
  }),
  z.object({
    type: z.literal("screenshot"),
    value: z.string().describe("Exact public http/https image URL to analyze as a screenshot reference."),
  }),
  z.object({
    type: z.literal("html"),
    value: z.string().min(1).describe("Raw HTML snippet to analyze as a bounded static reference."),
  }),
]);

export const inputSchema = z.object({
  urls: z.array(z.string()).min(1, "Provide at least one URL.").max(10, "Provide at most 10 URLs.").optional()
    .describe("One or more exact public http/https URLs to analyze. StyleTrace analyzes only the URLs you provide and does not crawl additional pages automatically."),
  references: z.array(referenceSchema).min(1, "Provide at least one reference.").max(10, "Provide at most 10 references.").optional()
    .describe("Mixed references to analyze. Use type=url for websites, type=image or type=screenshot for public image URLs, and type=html for bounded raw HTML snippets."),
  evidenceMode: z.enum(["omit", "file", "inline"]).optional()
    .describe("How evidence should be returned. Defaults to omit. Use file to export evidence to a sidecar JSON instead of embedding it in structuredContent."),
  targetArtifact: z.enum(["landing-page", "product-ui", "slide-deck", "prototype", "comparison-board", "other"]).optional()
    .describe("Optional target artifact to shape synthesis output for downstream agents. Does not change raw evidence capture."),
  fidelity: z.enum(["low", "medium", "high"]).optional()
    .describe("Optional fidelity target for downstream synthesis output. Does not change raw evidence capture."),
  designIntent: z.string().max(400).optional()
    .describe("Optional downstream generation intent used only to shape prompt-ready guidance."),
}).strict().superRefine((value, ctx) => {
  if (!value.urls?.length && !value.references?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least one URL or reference.",
      path: ["urls"],
    });
  }
});

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

const visualVocabularySchema = z.object({
  typeSystem: z.object({
    headlineScale: z.string(),
    headingStyle: z.string(),
    bodyStyle: z.string(),
    families: z.array(z.string()),
    confidence: z.enum(["high", "medium", "low"]),
  }),
  colorSystem: z.object({
    backgroundMode: z.enum(["light", "dark", "mixed"]),
    contrast: z.enum(["high", "medium", "low"]),
    paletteRestraint: z.enum(["restrained", "moderate", "varied"]),
    accentCount: z.number().int().nonnegative(),
  }),
  layoutSystem: z.object({
    contentWidth: z.string(),
    sectionRhythm: z.string(),
    density: z.enum(["airy", "balanced", "dense"]),
    moduleRhythm: z.enum(["editorial", "modular", "commerce"]),
  }),
  componentSystem: z.object({
    navDensity: z.enum(["minimal", "expanded"]),
    headerCtaPattern: z.enum(["none", "single-primary", "multiple-primary"]),
    heroCtaPattern: z.enum(["none", "single-primary", "dual-cta", "repeated"]),
    buttonRadius: z.enum(["sharp", "soft", "pill"]),
    buttonEmphasis: z.enum(["subtle", "mixed", "solid"]),
    cardDensity: z.enum(["none", "light", "heavy"]),
    formStyle: z.enum(["filled", "outlined", "mixed", "none"]),
  }),
  imagerySystem: z.object({
    heroMediaStyle: z.enum(["text-only", "split-media", "immersive-media"]),
    mediaWeight: z.enum(["none", "supporting", "dominant"]),
    iconDensity: z.enum(["low", "medium", "high"]),
    photoPresence: z.enum(["low", "medium", "high"]),
    illustrationPresence: z.enum(["low", "medium", "high"]),
    videoPresence: z.enum(["none", "present"]),
  }),
  motionSystem: z.object({
    motionLevel: z.enum(["restrained", "moderate", "active"]),
    stickyLevel: z.enum(["none", "light", "strong"]),
    hoverEmphasis: z.enum(["subtle", "clear", "strong"]),
    confidence: z.enum(["high", "medium", "low"]),
  }),
});

const styleInvariantSchema = z.object({
  id: z.string(),
  rule: z.string(),
  appliesTo: z.array(z.string()),
  strength: z.enum(["hard", "soft"]),
  confidence: z.enum(["high", "medium", "low"]),
  evidenceCount: z.number().int().nonnegative(),
});

const styleRiskSchema = z.object({
  id: z.string(),
  risk: z.string(),
  reason: z.string(),
  severity: z.enum(["high", "medium", "low"]),
});

const softGuessSchema = z.object({
  id: z.string(),
  area: z.string(),
  guidance: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const compositionBlueprintStepSchema = z.object({
  siteUrl: z.string(),
  pagePath: z.string(),
  module: z.enum(["hero", "features", "pricing", "proof", "cta", "comparison", "promo", "navigation", "footer", "content"]),
  role: z.string(),
  layout: z.string(),
  emphasis: z.enum(["low", "medium", "high"]),
  mediaRole: z.enum(["none", "supporting", "dominant"]),
  spacing: z.enum(["tight", "moderate", "open"]),
  surface: z.string(),
  ctaBehavior: z.enum(["none", "single-primary", "dual-cta", "repeated"]),
  preserve: z.array(z.string()),
  adaptationNotes: z.array(z.string()),
});

const variationAxisSchema = z.object({
  axis: z.enum(["density", "mediaWeight", "colorExpression", "chromeVisibility", "moduleRhythm", "ctaPressure"]),
  options: z.array(z.string()),
  recommended: z.string(),
  rationale: z.string(),
});

const blendModeSchema = z.object({
  mode: z.enum(["lead-reference", "common-core", "contrast-set"]),
  headline: z.string(),
  directives: z.array(z.string()),
});

const promptReadyBriefSchema = z.object({
  summary: z.string(),
  targetArtifact: z.enum(["landing-page", "product-ui", "slide-deck", "prototype", "comparison-board", "other"]),
  fidelity: z.enum(["low", "medium", "high"]),
  designIntent: z.string().optional(),
  buildPriorities: z.array(z.string()),
  do: z.array(z.string()),
  avoid: z.array(z.string()),
  reviewChecklist: z.array(z.string()),
});

const reviewContractSchema = z.object({
  mustMatch: z.array(styleInvariantSchema),
  mustAvoid: z.array(styleRiskSchema),
  compareAgainst: z.array(z.string()),
  viewportChecks: z.array(z.string()),
  uncertainAreas: z.array(z.string()),
});

const originalityBoundarySchema = z.object({
  safeToReuse: z.array(z.string()),
  doNotCopy: z.array(z.string()),
  adaptationGuidance: z.array(z.string()),
});

export const outputSchema = z.object({
  sites: z.array(
    z.object({
      url: z.string(),
      sourceType: z.enum(["url", "image", "screenshot", "html"]).optional(),
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
  visualVocabulary: visualVocabularySchema,
  styleInvariants: z.array(styleInvariantSchema),
  styleRisks: z.array(styleRiskSchema),
  softGuesses: z.array(softGuessSchema),
  compositionBlueprint: z.array(compositionBlueprintStepSchema),
  variationAxes: z.array(variationAxisSchema),
  blendModes: z.array(blendModeSchema),
  promptReadyBrief: promptReadyBriefSchema,
  reviewContract: reviewContractSchema,
  originalityBoundary: originalityBoundarySchema,
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
        siteUrl: z.string(),
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

export const reviewInputSchema = z.object({
  styleResult: outputSchema,
  generatedHtml: z.string().optional(),
  generatedImageUrl: z.string().optional(),
  viewportWidth: z.number().int().positive().optional(),
  viewportHeight: z.number().int().positive().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.generatedHtml && !value.generatedImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide generatedHtml or generatedImageUrl.",
      path: ["generatedHtml"],
    });
  }
});

export const reviewOutputSchema = z.object({
  mode: z.literal("style-review-v1"),
  artifactType: z.enum(["html", "image"]),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  matchedInvariants: z.array(z.object({
    id: z.string(),
    rule: z.string(),
    confidence: z.enum(["high", "medium", "low"]),
  })),
  violatedConstraints: z.array(z.object({
    id: z.string(),
    rule: z.string(),
    severity: z.enum(["high", "medium", "low"]),
    reason: z.string(),
  })),
  driftNotes: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});
