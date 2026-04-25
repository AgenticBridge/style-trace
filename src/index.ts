#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ZodError } from "zod";
import { analyzeWebsiteStyle } from "./analysis/analyzeStyle.js";
import { reviewGeneratedStyle } from "./analysis/reviewGeneratedStyle.js";
import { inputSchema, outputSchema, reviewInputSchema, reviewOutputSchema } from "./core/schema.js";
import type { ReviewGeneratedStyleInput } from "./core/types.js";

const server = new McpServer({
  name: "style-trace",
  version: "0.5.1",
});

server.registerTool(
  "analyze_website_style",
  {
    title: "Analyze website style",
    description: "Analyze exact public website URLs, public image URLs, or a mix of both and extract a compact design grammar. StyleTrace analyzes only the references you provide. Evidence can be omitted, exported to a sidecar file, or inlined.",
    inputSchema,
    outputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: false,
    },
  },
  async (args) => {
    try {
      const result = await analyzeWebsiteStyle(args);
      const text = `StyleTrace result ready in structuredContent for ${result.sites.length} site(s).`;

      return {
        content: [{ type: "text", text }],
        structuredContent: result,
      };
    } catch (error) {
      const message = formatError(error);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "review_generated_style",
  {
    title: "Review generated style",
    description: "Review generated HTML or a generated image URL against a StyleTrace result, checking invariant matches, drift, and likely style violations.",
    inputSchema: reviewInputSchema,
    outputSchema: reviewOutputSchema,
    annotations: {
      readOnlyHint: true,
      idempotentHint: false,
    },
  },
  async (args) => {
    try {
      const result = await reviewGeneratedStyle(args as ReviewGeneratedStyleInput);
      const text = `Style review ready in structuredContent for ${result.artifactType} artifact.`;

      return {
        content: [{ type: "text", text }],
        structuredContent: result,
      };
    } catch (error) {
      const message = formatError(error);
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("StyleTrace MCP server running on stdio");
}

function formatError(error: unknown): string {
  if (error instanceof ZodError) {
    return `Invalid input: ${error.issues.map((issue) => issue.message).join("; ")}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error during style analysis.";
}

main().catch((error) => {
  console.error("Fatal error in StyleTrace:", error);
  process.exit(1);
});
