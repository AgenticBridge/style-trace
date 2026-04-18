#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ZodError } from "zod";
import { analyzeWebsiteStyle } from "./analysis/analyzeStyle.js";
import { inputSchema, outputSchema } from "./core/schema.js";

const server = new McpServer({
  name: "style-trace",
  version: "0.3.2",
});

server.registerTool(
  "analyze_website_style",
  {
    title: "Analyze website style",
    description: "Analyze one or more exact public marketing-site URLs and extract a compact design grammar. StyleTrace analyzes only the URLs you provide. Evidence can be omitted, exported to a sidecar file, or inlined.",
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
