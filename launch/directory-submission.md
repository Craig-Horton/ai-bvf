# AI BVF directory submission pack

Status: draft prepared for review. This document does not submit a PR, post a comment or contact a maintainer.

## Verified submission history

The previous [awesome-mcp-servers submission, PR 6388](https://github.com/punkpeye/awesome-mcp-servers/pull/6388), was closed unmerged on 24 July 2026. The maintainer cited inactivity and an unfulfilled Glama badge requirement.

On 28 July, Craig replied that the server was indexed under Craig-Horton and that a fresh PR would follow. The new submission should use the current repository and listing identity.

## Requirements checked on 3 October 2026

The current [contribution guide](https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md) requires a public repository, an installable server, one concise entry, an appropriate category and alphabetical order. AI BVF has a public source repository and the local `aibvf-mcp` package.

The maintainer's comments on PR 6388 additionally require a Glama score badge and a completed quality evaluation. Those comments specify placing the badge after the server description.

Verify the live Glama evaluation before submitting. The historical report of an A score is not a fresh verification, and this draft makes no current grade claim.

## Proposed directory entry

Insert this single line under the appropriate existing category, in alphabetical order for Craig-Horton:

```markdown
- [Craig-Horton/ai-bvf](https://github.com/Craig-Horton/ai-bvf) - Assess AI investment proposals with a deterministic Stop, Fix or Accelerate verdict, disclosed assumptions, work architecture checks and improvement plans. Local TypeScript MCP server with a hosted connector. [![Craig-Horton/ai-bvf MCP server](https://glama.ai/mcp/servers/Craig-Horton/ai-bvf/badges/score.svg)](https://glama.ai/mcp/servers/Craig-Horton/ai-bvf)
```

Match any required category markers to the destination list's current legend during final preparation. Keep the benefit and evidence boundaries in the linked documentation.

## Pull request title

Add Craig-Horton/ai-bvf for AI investment assessment

## Pull request body

AI BVF assesses an AI investment proposal and returns Stop, Fix or Accelerate with disclosed assumptions, evidence gaps and a proposed next action.

- Public repository: https://github.com/Craig-Horton/ai-bvf
- Installable package: https://www.npmjs.com/package/aibvf-mcp
- Local command: `npx -y aibvf-mcp`
- Hosted connector: https://mcp.aibvf.com/api/mcp
- Glama listing and score badge: https://glama.ai/mcp/servers/Craig-Horton/ai-bvf
- First browser assessment: https://www.aibvf.com/start
- Reproducible example: https://github.com/Craig-Horton/ai-bvf/blob/main/docs/worked-example.md

The server exposes thirteen tools. The scoring engine uses disclosed AI BVF planning assumptions; EUR ranges require a separate costed business case, and the decision score has no calibrated probability interpretation.

Source code is MIT licensed. The specification and schema under `spec/` are CC-BY-4.0, with trademark terms in NOTICE.

This submission follows closed PR 6388 using the current repository identity and the required Glama badge.

## Verification record to complete before submission

| Check | Result to record |
|---|---|
| Current directory instructions and category | Pending final check |
| Registry identity and hosted URL ownership | Package listing uses Craig-Horton; hosted URL remains registered under Bahamas1717. Migration pending. |
| No duplicate existing entry | Pending final search |
| npm package version and local connection | Pending release check |
| Local tools/list returns thirteen tools | Pending release check |
| One local assessment returns a verdict and audit | Pending release check |
| Hosted connector responds to the same assessment | Pending release check |
| Glama listing loads, score is set and badge renders | Pending live check |
| Entry uses the current owner and is alphabetised | Pending draft review |

Record the date and evidence for each check. Submit once the record is complete, then track the submission URL, maintainer response and requested changes in the adoption plan.

## After submission

Assign one owner to check the PR every week until it is merged or explicitly declined. Record follow-up actions and dates so an unanswered requirement does not leave the submission inactive again.
