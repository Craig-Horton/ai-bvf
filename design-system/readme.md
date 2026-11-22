# AI BVF — Design System

The brand and UI system for **AI BVF (the AI Business Value Framework)** by **Craig Horton** — an open, deterministic toolchain that scores AI initiatives **Accelerate / Fix / Stop** before budget is committed. Board-review discipline for enterprise AI investment.

One engine, three surfaces: `@aibvf/core` (TypeScript scoring engine), `aibvf-mcp` (MCP server, thirteen tools for agents, hosted connector at mcp.aibvf.com), and `aibvf-check` (CI/CD pre-flight gate — "SonarQube for AI").

This design system unifies the product surfaces onto **one accent (copper) on deep navy**, correcting the multi-colour drift that had crept into the live pages. Serif display, executive tone.

## Sources

Built from the public repo (browse for deeper context — the reader is encouraged to explore these to build higher-fidelity work):

- **GitHub — `Craig-Horton/ai-bvf`**: https://github.com/Craig-Horton/ai-bvf
  - `developers.html` — the page for developers: the MCP server, the CI gate and the protocol. The older copies of the product app were removed on 22 November 2026; the live product is at www.aibvf.com.
  - `ai-readiness-blueprint.html` — the six-driver diagnostic marketing page (earlier, lighter palette — superseded here).
  - `assets/bvf-logo.svg` — the brand mark (imported into `assets/`).
  - `README.md` — product copy, the four pillars, the thirteen MCP tools, scoring rules.
- Live product: www.aibvf.com · Protocol: www.aibvf.com/protocol · The Transformation Brief: thetransformationbrief.ai

Brand seed (from the logo): deep navy `#0F1E35` + copper `#B87333`, serif display, executive tone.

---

## Content Fundamentals

**Voice — the analyst in the boardroom.** Authoritative, plain, unhype. Copy speaks to a senior decision-maker (CxO) and to the AI agent acting on their behalf. It is confident and slightly confrontational — it "holds up the mirror."

- **Person:** Mostly imperative and third-person about the work ("Score an initiative", "Stop bad AI projects"). First-person singular ("I") appears only in the founder/methodology voice (Craig Horton). Rarely "we."
- **The signature move — the question turned back:** *"Not can we build it — but should this survive a board review?"* This rhetorical inversion is the brand's core device. Use it for callouts (the **Mirror** component).
- **Casing:** Sentence case for headings and body. UPPERCASE with wide tracking only for micro-labels/eyebrows and button text. The three verdicts are Title Case: **Accelerate / Fix / Stop**.
- **Numbers & currency:** EUR, written `€37.8M`, ranges as `€10.8M–37.8M`. Scores are bare integers 0–100. Confidence is a bare integer. Set figures in mono.
- **Named entities stay literal:** `score_initiative`, `recommend_improvements`, `@aibvf/core`, `gen2`/`gen3`, pillar names (Strategic Alignment, Financial Return, Change Enablement, Governance Risk) — always exact, in mono where they're identifiers.
- **Benchmarks cited by name:** McKinsey, Gartner, BCG, Deloitte, EY/Oxford, Prosci — credibility comes from attribution.
- **No emoji. No exclamation-heavy hype.** Sentences are declarative and end cleanly. Tone example: *"The scoring belongs upstream of the slide deck, inside the agent's pre-flight check before the budget gets committed."*
- **Vibe:** measured, expensive, a little severe. Executive briefing, not SaaS marketing.

---

## Visual Foundations

**Palette — copper on navy, and nothing else decorative.**
- Background is a **deep-navy elevation scale** (`--navy-950` → `--navy-600`); surfaces are built by layering low-opacity white fills over navy (`--fill-1/2/3`) rather than distinct grey chips.
- **Copper `#B87333` is the single brand accent.** One accent, used for the eyebrow labels, primary buttons, focus rings, KPI values, chart fills, and the signature left-rule. Copper appears as solid, as light `#D9A672` (hover/bright text), and as translucent washes (`--copper-wash`, `--copper-line`).
- The only other colours are the **RAG verdict system** — green `#34C77B` Accelerate, amber `#E9A63C` Fix, red `#E5544C` Stop. These are *functional signal*, not decoration; never use them as brand accents. (The removed indigo/agent purple and the multi-colour drift are intentionally gone.)
- Text is a cool neutral ramp on navy: ice headings → dim meta.

**Type.** Display/headings/KPI values/quotes in **Playfair Display** (serif, 700 — upright, no italics). Body & UI in **DM Sans** (300–700). Data/EUR/scores in **IBM Plex Mono**. Headings tracked tight (−0.01em); eyebrow labels tracked wide (2.4px) and uppercase. Body text is crisp near-white on dark (never cream), navy ink on light.

**Backgrounds.** Flat deep navy, occasionally warmed by a single soft **radial glow** behind hero content (`radial-gradient(ellipse at 50% 26%, rgba(41,70,103,0.35), transparent)`). No photography, no illustration, no repeating texture, no busy gradients. Restraint is the aesthetic.

**Cards & surfaces.** Fill `rgba(255,255,255,0.06)`, 1px hairline border `rgba(255,255,255,0.08)`, radius **10px**, soft dark shadow. The **accent/callout** variant squares the left corners and adds a **3px copper left rule** (radius `0 10px 10px 0`) — this is the "mirror"/boardroom-sentence treatment, used consistently across surfaces.

**Corner radii.** Restrained: badges 5px, buttons 6px, inputs/panels 8px, cards 10px, hero/feature 14px. Pills only for the RAG dot and range tracks.

**Borders & hairlines.** Almost everything is separated by 1px white-alpha hairlines, not heavy borders. Copper hairlines (`--copper-line`) mark accented edges.

**Shadows.** Soft, dark, low-contrast — shadows read as depth on navy, never as glow. Copper elements get a warm `--shadow-accent`. Focus rings are a 3px translucent copper halo.

**Motion.** Understated. `cubic-bezier(0.4,0,0.2,1)`, 160–400ms. Fades and short upward translations on entrance; meter/bar widths transition on value change. No bounce, no infinite decorative loops.

**Hover / press.** Hover = *lighten* (copper → copper-300, fills raise one step, hairlines warm to copper). Press = a subtle `scale(0.97)`. Ghost buttons warm their border + text to copper on hover.

**Transparency & blur.** The sticky header uses `backdrop-filter: blur(20px)` over a translucent navy. Washes (copper/white alpha) do the work that solid fills would elsewhere — the whole system leans on translucency layered over navy.

**Layout.** Centred content column (~1120–1200px max) with generous 32–40px gutters. Sticky 68px header. Sections stacked with big vertical rhythm. Grids with `gap` (never inline flow).

---

## Iconography

The source product is **near-iconless by design** — an executive aesthetic that avoids icon clutter. Its visual signals are typographic and geometric rather than pictographic:

- **The RAG dot** — a small glowing filled circle in the verdict colour (see `VerdictBadge`). This is the most-used "icon" in the system.
- **Copper hairline rules** — thin lines and the 3px left-rule stand in for section iconography.
- **Unicode used sparingly** — a `▾` chevron for selects; `·` and `—` as typographic separators in copy. No icon font, no SVG icon sprite ships in the source.
- **The logo** (`assets/bvf-logo.svg`) is the one bespoke mark: a navy plate with copper hairline rules, a `BVF` monogram in a rounded rectangle, the serif wordmark, and a row of copper role pills (CEO/CFO/CDO/CIO/CHRO/CRO).
- **No emoji anywhere.**

**Guidance:** keep interfaces icon-light. If an icon set becomes necessary (e.g. for a denser app view), use a **thin-stroke line set** (Lucide, ~1.5px stroke, CDN) in copper or muted text — *flagged as an addition*, since the source ships none. Prefer a label + hairline over an icon.

---

## Index / Manifest

**Root**
- `styles.css` — global entry (import manifest only). Consumers link this.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`, `base.css`.
- `assets/bvf-logo.svg` — brand mark.
- `guidelines/*.card.html` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `SKILL.md` — Agent Skills wrapper.

**Components** (`window.AIBVFDesignSystem_ab2d84`)
- `components/core/` — **Button**, **VerdictBadge**, **Label**, **Card**, **KpiCard**, **PillarMeter**, **Mirror**
- `components/forms/` — **Input**, **Select**
- `components/feedback/` — **GateBadge** (CI PASS/FAIL stamp), **Scorecard** (the signature `aibvf-check` gate report)

**UI Kits**
- `ui_kits/bvf-app/` — interactive scoring app (Score / Portfolio / Advisor tabs).
- `ui_kits/protocol/` — landing / protocol page (`index.html`, **theme-aware light + dark**), README hero + tool table (`readme-hero.html`), and the 1200×630 social/OG card (`og-card.html`).

## Theming
Dark navy is the default. Add `data-theme="light"` to `<html>` (or any wrapper) for the warm-ivory light theme — same single copper accent, navy ink. Tokens live in `tokens/theme-light.css` (imported last so its overrides win the cascade). Every component and surface reads semantic/raw tokens, so both themes flip with no per-component work; the protocol page ships a Dark/Light toggle.

## Caveats
- **Fonts** (Playfair Display, DM Sans, IBM Plex Mono) load from Google Fonts CDN via `tokens/fonts.css` — the source repo self-hosts no font binaries, so nothing to import. IBM Plex Mono is an addition for data figures. Swap if you have licensed alternatives.
- The unified palette **reconciles drift**: values are anchored to the brand-seed navy/copper, not copied verbatim from any single drifted page.
- **Intentional additions:** `PillarMeter` and `KpiCard` are named primitives distilled from repeated inline patterns in the source app; `GateBadge` + `Scorecard` render the `aibvf-check` CI gate (the "SonarQube for AI" surface) as a reusable signature visual; `IBM Plex Mono` for data. Everything else maps to existing source patterns.
