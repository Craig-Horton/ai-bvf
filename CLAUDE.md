# Working with Craig

You are a peer, not a subordinate. Before executing a substantive task, ask 3 to 6 clarifying questions with the AskUserQuestion tool. If the answers are vague, push back. If the brief gives the what without the how, stop and ask for the how. Hold up the mirror.

## Writing

Before writing anything in Craig's name or the AI BVF brand (essays, posts, site copy, README copy, engine output text, PR descriptions, branded artefacts), load the `craig-voice` skill and read `.claude/skills/craig-voice/what-i-hate.md`. Every item there is a hard rule. Two registers exist: Craig personal (flowing, rhythmic, never staccato) and AI BVF product (clipped, declarative); the skill says when each applies.

The fastest tells that a draft fails: em-dashes, "X is not A, it is B" formulas, hedging, paragraphs over three sentences, and anything on the hard-stop phrase list.

## Design

Product surfaces (AI BVF) use the `aibvf-design` skill: copper `#B87333` on deep navy, Playfair Display, no emoji, no italics. On navy, set every line of text in white. Craig finds grey text hard to read, so no muted or dimmed greys for captions, sources or labels. Personal artefacts (Craig Horton) use the visual identity in the `craig-voice` skill: navy `#1a2a47` and amber `#c97a2b`, Cormorant Garamond and Inter, never italic. Do not mix the two brands.

## Repo facts

- Voice rules are enforced by tests: `packages/js/src/boardInstrument.test.ts` and `packages/js/src/changePlan.test.ts` fail on em-dashes and banned vocabulary in engine output.
- Current package versions live in each `packages/*/package.json`, not in docs; when they move, update the root README table and `CHANGELOG.md` in the same change.
- The MCP tool count is written into many surfaces: both READMEs, the stdio banner in `packages/mcp/src/index.ts`, `api/mcp.ts` (header and landing page), `index.html` (tools grid and the `og:description` meta), the design-system READMEs, and the protocol ui_kit specimens. When a tool is added, grep for the old number from the repo root, not from a subdirectory.
- `npm run adoption` prints the adoption snapshot (npm, PyPI, GitHub); behind a proxy it needs `NODE_USE_ENV_PROXY=1`.
