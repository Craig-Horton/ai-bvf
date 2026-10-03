# LinkedIn launch draft

Audience: senior leaders making AI investment decisions.

Draft only. Verify current package and registry metadata before posting.

## Post

AI BVF gives a Claude agent a pre-flight check before it recommends an AI deployment, starting from a proposal in plain English and returning Accelerate, Fix or Stop with a change plan.

I built it because I kept watching agents confidently greenlight AI projects with no reference to the business case, no reference to operating-model readiness, and no reference to governance exposure. Four pillars, strategic alignment, financial return, change enablement and governance risk, each scored 0 to 100, and a deterministic classification of Accelerate, Fix, or Stop. The model uses disclosed AI BVF planning assumptions, with external research as context and readiness capture informed by EY/Oxford and Prosci.

Worked example, a 800M EUR hospital group running an agentic discharge coordination pilot. Four-pillar scores SA 75, FR 55, CE 40, GR 55 return Fix, with modelled net value between 24M and 83M EUR and a decision confidence of 54. recommend_improvements returns three specific raises, rebuild the business case with a readiness-adjusted capture rate, fund change management at 15 to 25 percent of initiative spend with a named owner, commission a pre-deployment governance review covering EU AI Act classification and human-in-the-loop design. The pillar improvements project a decision confidence of 68; Accelerate also requires evidence that workflows, affected roles, human decision rights and performance measures are ready.

The same organisation in gen3 agentic mode with traditional readiness has a modelled annual Organisational Drag Cost of 20M to 36M EUR, and that is structural friction separate from the AI build. A CFO reads that number and understands the conversation immediately.

Thirteen tools support the decision from initial assessment through improvement planning and portfolio sequencing, available through a local MCP client or the hosted claude.ai connector. Describe one proposal in plain English, review the assumptions with the people who own the work, then supply evidence and rerun the assessment.

The benchmark corpus is directional, the protocol is open, the calibration will improve through public review. If you run AI portfolios in your day job and the numbers look wrong, file an issue or push a PR, I would rather argue the calibration in public than ship a quiet tool no one checks.

If you own an AI portfolio, take one proposal through the assessment and test whether the change plan answers the questions your team has to act on.

Repo: https://github.com/Craig-Horton/ai-bvf

#AIBVF #MCP #AgenticAI #AITransformation #EnterpriseAI #AIGovernance

