# Apple + Pixel + Samsung review set

This instance is the primary visual-comparison benchmark for StyleTrace.

It is intentionally strict:

- analyze only the exact reference pages
- regenerate both comparison variants with an LLM on every run
- compare `with MCP` against `without MCP` using the same reference set
- inspect the generated diff board instead of relying only on JSON deltas
