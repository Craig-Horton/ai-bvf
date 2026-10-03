# HN launch draft

Status: prepared for review, not posted. Use the [directory submission pack](directory-submission.md) for the separate awesome-mcp-servers submission.

## Title

Show HN: Review an AI proposal with a reproducible decision model

## Post

I built AI BVF to help teams review an AI investment proposal and identify the evidence needed for the next decision.

The browser entry point takes a proposal in plain English and returns Stop, Fix or Accelerate, with supplied and estimated inputs, a work architecture check and the next questions. The first assessment needs no account: https://www.aibvf.com/start

For a technical example, the repository includes an executable healthcare case. Raising the supplied pillar scores still leaves the verdict at Fix until workflow, roles, human decision rights and measures are also evidenced.

The scoring path is deterministic. Its EUR ranges are planning scenarios based on disclosed AI BVF assumptions, and its decision score is a rule-based summary with no calibrated probability interpretation.

The legacy API names include `net_value_eur` and `decision_confidence`. The documentation explains that the former applies a readiness capture factor without deducting project costs, and that the latter is a score.

There are thirteen MCP tools for an assessment, improvement planning and portfolio work. A hosted connector is available at https://mcp.aibvf.com/api/mcp, and local clients can run `npx -y aibvf-mcp`.

I am looking for counterexamples: a proposal, the result, the decision you expected, and the evidence for it. The engine and examples can then be tested against the disagreement.

Source code is MIT licensed, the public specification under `spec/` is CC-BY-4.0, and trademarks have separate terms in NOTICE.

Browser: https://www.aibvf.com/start  
Repository: https://github.com/Craig-Horton/ai-bvf  
Worked example: https://github.com/Craig-Horton/ai-bvf/blob/main/docs/worked-example.md  
MCP setup: https://github.com/Craig-Horton/ai-bvf/blob/main/packages/mcp/README.md

## Checks before posting

Confirm the browser example, hosted tool call, local installation and worked-example assertions on the release being announced. Record the package versions and checks in the release notes, and use only observed pilot outcomes that have publication consent.
