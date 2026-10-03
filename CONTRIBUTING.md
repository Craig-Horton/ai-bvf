# Contributing to AI BVF

Bring a reproducible case, a source correction or a small code change. The most useful contribution identifies a decision the current model handles poorly and provides evidence for a better rule.

## Start with a counterexample

Open an [issue](https://github.com/Craig-Horton/ai-bvf/issues/new) for a reproducible bug or a [discussion](https://github.com/Craig-Horton/ai-bvf/discussions) for a proposed calibration change. Remove confidential and personal information before posting.

Copy this template:

```text
Engine/package version:
Route: browser / local MCP / hosted MCP / core / CLI / Python
Synthetic or shared with permission:
Inputs:
Actual verdict and relevant output:
Expected decision:
Evidence behind the expected decision:
Which inputs were measured, supplied or estimated:
Work architecture checks and supporting evidence:
Source URL, publication date and relevant passage:
Proposed change or question:
How someone else can reproduce it:
```

A citation must support the specific proposed assumption. Record its population, scope and limitations; a broad transformation survey does not establish a function-specific benefit percentage.

## Review criteria

A maintainer should record whether the change improves an observed case, which other cases it affects, and why the evidence supports the proposed rule. Include a counterexample where a higher or lower threshold changes the outcome.

Public discussion can lead to a test, a documentation clarification or a model change. The contributor and the resolution should appear in the relevant PR and release notes when the change is accepted.

Useful first contributions include:

- Reproducing the [worked example](docs/worked-example.md) and reporting a difference.
- Correcting a source attribution or identifying a limit the result should disclose.
- Providing a synthetic input that exposes a missing question or misleading recommendation.
- Checking an installation path and recording the client and platform versions.
- Improving accessibility or instructions at a point where a real user got stuck.

## Code and documentation changes

1. Fork the repository and branch from `main`.
2. Keep the change scoped to one behaviour or claim.
3. Describe the user trigger and resulting behaviour in the PR.
4. Run the relevant checks and report their results, including anything untested.
5. Resolve the Test workflow and applicable CodeQL checks before merge.

The TypeScript scoring path remains deterministic. Changes to model outputs must preserve input provenance and carry tests for the decision boundary they affect.

## Local development

```bash
git clone https://github.com/Craig-Horton/ai-bvf
cd ai-bvf
npm ci
npm run build
npm test
```

The suite includes the core and CLI tests, MCP telemetry checks and MCP response tests. Starting `node packages/mcp/dist/index.js` opens a stdio server; a client is needed to make tool calls.

Documentation that promises a result should include explicit inputs and a reproducible check. The [worked example](docs/worked-example.md#run-the-example-against-the-built-source) includes assertions for its published numbers and verdicts.

## Licensing and contribution boundaries

[LICENSE](LICENSE) grants MIT rights for repository source code. [NOTICE](NOTICE) sets out the CC-BY-4.0 specification and schema under `spec/`, together with the trademark exceptions.

Code contributions follow the repository source license. Specification changes follow the license of the specification being changed, and a contributor must have the right to submit the material.

Existing references to a proprietary benchmark corpus concern a separate contribution route requiring a written agreement with Craig Horton Advisory. Before submitting material through that route, ask the maintainer to identify the corpus and the terms for the particular material.

Public source corrections, bug reports and discussion of the disclosed constants can use the ordinary repository process. This guide does not add restrictions to rights already granted by LICENSE or NOTICE, and it does not grant rights to separately licensed material or certification marks.

Keep client datasets, confidential cases and third-party text whose redistribution is restricted out of public issues and PRs. A synthetic reproducer and a link to the source are sufficient to begin a review.
