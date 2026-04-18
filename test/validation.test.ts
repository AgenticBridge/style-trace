import test from "node:test";
import assert from "node:assert/strict";
import { inputSchema } from "../src/schema.js";
import { normalizeInput, normalizePublicUrl } from "../src/validation.js";

test("normalizePublicUrl rejects localhost URLs", () => {
  assert.throws(() => normalizePublicUrl("http://localhost:3000"), /public URLs/);
});

test("normalizeInput applies defaults and deduplicates URLs", () => {
  const normalized = normalizeInput({
    urls: ["https://example.com", "https://example.com#hero"],
  });

  assert.deepEqual(normalized.urls, ["https://example.com/"]);
  assert.equal(normalized.maxPagesPerSite, 4);
  assert.equal(normalized.pageSelectionMode, "auto");
  assert.equal(normalized.synthesisMode, "single-site-profile");
});

test("inputSchema accepts maxPagesPerSite up to 5", () => {
  const parsed = inputSchema.parse({
    urls: ["https://example.com"],
    maxPagesPerSite: 5,
  });

  assert.equal(parsed.maxPagesPerSite, 5);
});
