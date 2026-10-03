# HN launch draft

## Title Options, Ranked

1. Show HN: An MCP server that scores AI initiatives Accelerate, Fix, or Stop
2. Show HN: aibvf-mcp, open protocol for pre-flight AI portfolio scoring
3. Show HN: Give your Claude agent a second opinion before it recommends an AI project

Recommendation: Option 1. Direct, tells the reader the interface and the output in nine words.

Draft only. Verify current package and registry metadata before posting.

## Body

aibvf-mcp is an open Model Context Protocol server that starts from a proposal in plain English, resolves decision inputs, applies disclosed AI BVF planning assumptions and a readiness capture model, and returns Accelerate, Fix, or Stop with a modelled EUR value range, decision confidence, and an applied-modules list.

Thirteen tools are available over local stdio or the hosted connector. Start with assess_ai_initiative, use recommend_improvements for the change plan, or assemble, score and sequence a portfolio.

Why I built it. I kept watching Claude agents confidently recommend AI deployments with no reference to the business case, no reference to operating model readiness, and no reference to governance exposure. You can ask Claude to write you a one-pager on rolling out agentic discharge coordination in a 800M EUR hospital group and get back an executive summary that reads like a vendor pitch. The scoring belongs in the agent's pre-flight check before the decision.

The four pillars are Strategic Alignment, Financial Return, Change Enablement, Governance Risk, each 0 to 100, honest self-assessment. The scoring engine runs locally and deterministically. GR >= 70 or FR <= 20 returns Stop; SA, FR and CE >= 60 with GR <= 40 clear the pillar test for Accelerate; anything else returns Fix with a specific gap list.

Accelerate also requires evidence that workflows, roles, human decision rights and measures are ready; partial or missing evidence and stated gaps hold the verdict at Fix. External research provides context for the disclosed AI BVF planning assumptions. Readiness capture rates come from EY/Oxford and Prosci change-success research.

recommend_improvements is the answer to "what do I do next." It takes a Stop or Fix and returns the pillar raises that would flip classification toward Accelerate, each with a named action and a rationale. calculate_pace_layer_drag returns the annual Organisational Drag Cost in EUR from running an AI tier that outruns your operating model, so a gen3 agent in a siloed org reads back at 4.5 to 8 percent of revenue in annual structural friction, separate from the AI build cost.

Install: npm install -g aibvf-mcp. Configure your MCP client using packages/mcp/README.md. For claude.ai, add https://mcp.aibvf.com/api/mcp as a custom connector under Settings, Connectors. There is a worked example in docs/worked-example.md with the full math on a healthcare portfolio.

What I want you to tell me I got wrong. The benchmark ranges are directional, they are disclosed planning assumptions, with external research as context, and the industry multipliers are a starting calibration. I would rather argue the numbers in public and improve the protocol than ship a quiet tool no one checks. File an issue or push a PR.

Repo: https://github.com/Craig-Horton/ai-bvf
Registry: https://registry.modelcontextprotocol.io/servers?search=aibvf
Protocol page: https://www.aibvf.com/protocol
