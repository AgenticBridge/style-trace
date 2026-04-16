import type { StyleTraceResult } from "./types.js";

export function renderMarkdownSummary(result: StyleTraceResult): string {
  const lines: string[] = ["## StyleTrace summary", ""];

  for (const site of result.sites) {
    lines.push(`- **${site.url}** — pages: ${site.pagesAnalyzed.join(", ")}`);
    lines.push(`  - reproduction cues: ${formatReproduction(site.styleProfile.reproduction)}`);
  }

  lines.push("");
  lines.push(`**Shared visual tone:** ${formatList(result.observedCommonalities.visualTone)}`);
  lines.push(`**Repeated layout patterns:** ${formatList(result.observedCommonalities.layoutPatterns)}`);
  lines.push(`**Component commonalities:** ${formatList(result.observedCommonalities.componentPatterns)}`);
  lines.push("");
  lines.push("**Distilled implementation rules:**");

  for (const rule of result.guideline.rules) {
    lines.push(`- ${rule.rule} (${rule.confidence}, evidence ${rule.evidenceCount})`);
  }

  lines.push("");
  lines.push("**Unsupported patterns to avoid:**");
  for (const item of result.guideline.avoid) {
    lines.push(`- ${item.rule} ${item.reason}`);
  }

  return lines.join("\n");
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none established from the analyzed evidence";
}

function formatReproduction(reproduction: StyleTraceResult["sites"][number]["styleProfile"]["reproduction"]): string {
  return [
    `${reproduction.header.navDensity} header with ${reproduction.header.ctaPattern}`,
    `${reproduction.hero.headingScale} ${reproduction.hero.mediaStyle} hero and ${reproduction.hero.ctaPattern}`,
    `${reproduction.buttons.radius} ${reproduction.buttons.emphasis} ${reproduction.buttons.size} buttons`,
    `${reproduction.commerce.pricingPresence} pricing path`,
  ].join(", ");
}
