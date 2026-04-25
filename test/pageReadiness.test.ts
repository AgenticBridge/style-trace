import test from "node:test";
import assert from "node:assert/strict";
import { loadAndSettlePage, settleLoadedPage } from "../src/analysis/pageReadiness.js";

class FakePage {
  calls: string[] = [];

  async goto(url: string, options: { waitUntil: string; timeout: number }): Promise<void> {
    this.calls.push(`goto:${url}:${options.waitUntil}:${options.timeout}`);
  }

  async waitForLoadState(state: string, options: { timeout: number }): Promise<void> {
    this.calls.push(`load-state:${state}:${options.timeout}`);
  }

  async waitForTimeout(ms: number): Promise<void> {
    this.calls.push(`timeout:${ms}`);
  }

  async evaluate<TArg>(fn: ((arg: TArg) => unknown) | (() => unknown), arg?: TArg): Promise<{ height: number; viewport: number } | void> {
    const source = fn.toString();
    if (source.includes("scrollHeight")) {
      this.calls.push("evaluate:metrics");
      return { height: 2100, viewport: 900 };
    }

    if (typeof arg === "number") {
      this.calls.push(`evaluate:scroll:${arg}`);
      return;
    }

    this.calls.push("evaluate:scroll-top");
  }
}

test("loadAndSettlePage uses a stronger readiness sequence before analysis", async () => {
  const page = new FakePage();
  const overlayCalls: string[] = [];

  await loadAndSettlePage(page as never, "https://example.com", {
    dismissOverlays: async () => {
      overlayCalls.push("dismissed");
    },
  });

  assert.equal(overlayCalls.length, 1);
  assert.deepEqual(page.calls, [
    "goto:https://example.com:domcontentloaded:45000",
    "load-state:networkidle:5000",
    "timeout:5000",
    "timeout:250",
    "evaluate:metrics",
    "evaluate:scroll:0",
    "timeout:250",
    "evaluate:scroll:810",
    "timeout:250",
    "evaluate:scroll:1620",
    "timeout:250",
    "evaluate:scroll-top",
    "timeout:400",
  ]);
});

test("settleLoadedPage still warms scroll content when networkidle never settles", async () => {
  const page = new FakePage();
  page.waitForLoadState = async () => {
    page.calls.push("load-state:failed");
    throw new Error("timed out");
  };

  await settleLoadedPage(page as never, {
    settleDelayMs: 1200,
    scrollPauseMs: 100,
    topPauseMs: 50,
  });

  assert.deepEqual(page.calls, [
    "load-state:failed",
    "timeout:1200",
    "evaluate:metrics",
    "evaluate:scroll:0",
    "timeout:100",
    "evaluate:scroll:810",
    "timeout:100",
    "evaluate:scroll:1620",
    "timeout:100",
    "evaluate:scroll-top",
    "timeout:50",
  ]);
});
