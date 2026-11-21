# Launch post: the OpenClaw rollout, assessed

Audience: senior leaders deciding on AI investment, and the transformation leads who advise them.

Status: prepared for review, not posted. Post only after `@aibvf/core` 0.12.0 and the `/verdict` brief are live, because the post describes both.

## The worked example

The company is synthetic. Every answer below was chosen by the author to represent a firm at the start of this decision, and the post says so.

**Proposal as typed**

> We are a 400-person professional services firm. We want to give every employee OpenClaw, an agentic AI assistant that reads their email, calendar and client files and takes actions on its own, as a bolt-on to how we work today.

**Context supplied:** business function IT, AI type agentic AI. Industry and headcount were read from the proposal.

| Question | Answer chosen | Why this answer |
|---|---|---|
| Cost and return | The return rests on figures nobody has tested, or it only breaks even. | No firm has measured figures before a rollout. |
| Risk and control | The risks are known, and no named person owns them. | The security reporting is public, and ownership is the open point. |
| Business result | A result is named, with no target. | "Productivity" is named in most such requests, with no number. |
| Ownership of the change | An owner is named and the change work is funded. | Given the benefit of the doubt. |
| Redesign of the work | Nothing yet. The AI is added to the existing process. | The proposal says "bolt-on". |

**Result, engine 0.12.0:** Fix. Four things hold it back. First step: "Build the cost and return case on measured figures and have finance check it."

**Second run, best answer to every question:** still Fix. The proposal says "bolt-on" and the answer claims all four parts of the work were redesigned. The engine quotes the words beside the answer and asks which one is true.

Both runs reproduce with `assessInitiative` using the proposal and answers above.

## Post

OpenClaw is an open-source personal AI agent that lives in your chat apps, reads your mail and your calendar and acts for you while you sleep, and its repository has passed 390,000 stars on GitHub.

So I took the obvious request, roll it out to our staff, and ran it through AI BVF using a company I made up: a 400-person professional services firm that wants to give every employee OpenClaw as a bolt-on to how the firm works today.

I answered the five questions the way a firm at the start of this decision would answer them. The return rests on figures nobody has tested, the risks are known and nobody owns them, the result has a name and no target, an owner is named and funded, and nothing in the work itself has been redesigned.

The verdict was Fix, with four things holding it back, and the first step was to build the cost and return case on measured figures and have finance check it.

Then I picked the best answer to every question, to see whether the tool could be talked into a yes. The verdict stayed at Fix, because the proposal said "bolt-on" while the answer claimed the work had been redesigned, and the tool put the two side by side and asked me which one was true.

That one line is the conversation a leadership team needs before the money moves. What changes in the work, in the roles and in who can overrule the agent, when four hundred people each have one acting in their name?

Koi Security reported 341 malicious skills among 2,857 in OpenClaw's public registry in February, so the question of who owns the risk is already on the table.

The example is synthetic and the answers are mine. Run your own initiative through the same five questions, which takes a few minutes and needs no account, then send the one-page brief to the person who has to sign it off: https://www.aibvf.com/start

## Check before posting

- The GitHub star count. It read 394.9k on 21 November 2026 and moves daily.
- The Koi Security figures, against https://thehackernews.com/2026/02/researchers-find-341-malicious-clawhub.html.
- That `/start` shows "Your idea says" on the second run, and that the brief link opens.
- Attach the brief from the first run as the image, so the post carries the artefact it describes.

## Publication boundary

The firm, its answers and the verdict are an illustration. They must not be presented as a client, a case or an assessment of OpenClaw as a product. The verdict is about one firm's readiness to roll it out.
