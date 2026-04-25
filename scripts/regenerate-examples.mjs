import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { analyzeWebsiteStyle } from "../dist/src/analysis/analyzeStyle.js";

const repoRoot = process.cwd();
const examplesDir = path.join(repoRoot, "examples");
const version = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")).version;

for (const name of await readdir(examplesDir)) {
  const exampleDir = path.join(examplesDir, name);
  const metadataPath = path.join(exampleDir, "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const analysisDir = path.join(repoRoot, ".tmp", "example-regeneration", name);
  await mkdir(analysisDir, { recursive: true });

  const result = await analyzeWebsiteStyle({
    references: [{ type: "url", value: metadata.referenced_website_url }],
    evidenceMode: "file",
    targetArtifact: "landing-page",
    fidelity: "high",
    designIntent: "Promote the StyleTrace MCP product while preserving the reference site's design grammar without copying branded copy or assets.",
  });

  const resultPath = path.join(analysisDir, "mcp-result.json");
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const evidencePaths = collectVisualCapturePaths(result.evidenceArtifactPath ? JSON.parse(await readFile(result.evidenceArtifactPath, "utf8")) : undefined);
  const prompt = [
    "Generate exactly one standalone HTML homepage for the project https://github.com/AgenticBridge/style-trace.",
    "Use the attached local StyleTrace result as the primary source of truth. This result was produced from the current local codebase, not the published package.",
    `Reference URL: ${metadata.referenced_website_url}`,
    "Requirements:",
    "- output only raw HTML, no markdown fences or explanation",
    "- inline CSS only",
    "- no external assets or external scripts",
    "- keep the page original in copy and illustration treatment; do not reuse branded copy or logos from the reference site",
    "- preserve the extracted hierarchy, spacing discipline, chrome treatment, and module rhythm",
    "- use promptReadyBrief, styleInvariants, styleRisks, compositionBlueprint, reviewContract, and visualVocabulary as hard guidance",
    "- include a hero, 2-4 body sections, and a clear CTA path",
    "- keep it screenshot-reviewable",
    "- do not average into a generic SaaS page if the reference is editorial, product-led, or restrained",
  ].join("\n");

  const html = await runOpenCode([
    "run",
    "--pure",
    "--format",
    "json",
    "--dir",
    repoRoot,
    "--file",
    resultPath,
    ...evidencePaths.flatMap((filePath) => ["--file", filePath]),
    "--",
    prompt,
  ]);

  if (!html.trim().toLowerCase().startsWith("<!doctype html") && !html.trim().toLowerCase().startsWith("<html")) {
    throw new Error(`OpenCode did not return standalone HTML for ${name}.`);
  }

  await writeFile(path.join(exampleDir, "index.html"), `${html.trim()}\n`, "utf8");

  metadata.datetime_generated = new Date().toISOString();
  metadata.style_trace_version = version;
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  console.log(`updated ${name}`);
}

function collectVisualCapturePaths(evidenceArtifact) {
  if (!evidenceArtifact) {
    return [];
  }

  return evidenceArtifact.sites
    .flatMap((site) => site.visualCaptures ?? [])
    .flatMap((capture) => capture.kind === "hero" || capture.kind === "section" ? [capture.path] : []);
}

async function runOpenCode(args) {
  const stdout = await runCommand("opencode", args);
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const textEvents = lines.flatMap((line) => {
    try {
      const event = JSON.parse(line);
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

async function runCommand(command, args) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with code ${code}\n${stderr}`));
    });
  });
}
