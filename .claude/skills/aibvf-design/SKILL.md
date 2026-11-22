---
name: aibvf-design
description: Use this skill to generate well-branded interfaces and assets for AI BVF (the AI Business Value Framework, by Craig Horton), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation
- **One accent (copper `#B87333`) on deep navy (`#0F1E35`).** No other decorative colour. RAG (green/amber/red) is functional signal only — Accelerate / Fix / Stop.
- **Type:** Playfair Display (serif — headings, KPI values, quotes; upright, no italics), DM Sans (body/UI), IBM Plex Mono (EUR figures, scores).
- **Themes:** dark navy by default; add `data-theme="light"` to `<html>` for the warm-ivory light theme. Same copper accent both ways.
- **Tone:** executive/advisory, measured, "holds up the mirror." No emoji, no hype. See README → Content Fundamentals.
- Link `styles.css` for all tokens. Components live under `window.AIBVFDesignSystem_ab2d84` via `_ds_bundle.js`.

## Key files
- `styles.css` + `tokens/` — colors, type, spacing, fonts.
- `guidelines/*.card.html` — visual specimens.
- `components/core|forms/` — Button, VerdictBadge, Label, Card, KpiCard, PillarMeter, Mirror, Input, Select.
- `components/feedback/` — GateBadge, Scorecard (the signature CI PASS/FAIL gate).
- `ui_kits/bvf-app/`, `ui_kits/protocol/` — full-screen recreations to copy from (protocol page is light/dark, plus a README hero and 1200×630 OG card).
- `assets/bvf-logo.svg` — the brand mark.
