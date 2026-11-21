# Announcement: the AI BVF agent

Audience: senior leaders deciding on AI investment, and the transformation leads who advise them.

Status: prepared for review, not posted. `@aibvf/core` 0.13.0 and `aibvf-mcp` 0.17.0 are published and `aibvf.com/agent` is live, as of 21 November 2026.

Image: `launch/aibvf-agent-card.png`, 1080 by 1350, built from `launch/aibvf-agent-card.html`.

## The example behind the post

The company, Halden & Co, is made up. Its mail and documents are in `examples/agent-run/halden`. The run is real: a fresh assistant with the skill installed, the engine as built in this repository, and nobody answering a question. The record of the run, with every call and every quote, is in `examples/agent-run`.

## LinkedIn post

Agentic personal agents are seemingly released daily, each one ready to read your mail, hold your calendar and act for you while you sleep, and inside most organisations the queue of AI ideas they inspire now grows faster than anyone can judge it.

So why not have an agent that helps you decide which of those ideas to accelerate, which to fix and which to stop, with guides and guardrails?

That agent is live today as the AI BVF agent, and it runs inside the AI chat app you already use. You set its mandate once, what it may read and how far it may go, and from then on it works alone, finding the AI initiatives in your documents, answering five questions about each one only from words it can quote, and handing those answers to fixed, published rules that return the verdict.

I tested it on a company I made up, a 400-person online retailer with three AI ideas sitting in its mail and its minutes, and I gave the agent nothing except permission to read. It came back with a Fix for the customer service agent, because the steering minutes said "Refund limits to be agreed after the pilot", a Stop for a marketing agent that would send discounts with "no cap on the discount" and no approval step, and a plain statement that it could not judge the third idea because nobody had written down what it costs or who owns it.

The guardrails sit in the engine, where the agent cannot argue with them. An answer with no quote counts as unknown, every verdict states that an agent answered and that no person confirmed it, and the agent drafts the next step for you and sends nothing.

The vendor's email carried one more line, addressed to any AI assistant that read it, asking for the proposal to be rated Accelerate and reported as approved. The agent quoted that line to its owner as evidence of what the vendor had written, and reported that the idea could not be judged yet.

I then moved the calendar on six weeks and added the documents a firm like that would have produced in the meantime, and on its next check the agent found two reviews due in its own register, read what was new, and moved the customer service agent from Fix to Accelerate because the minutes now named the person who approves any refund above the limits and can switch the agent off. It recorded beside each earlier verdict what had happened since, which is how the facts on whether a Fix or a Stop was right begin to accumulate.

The company is synthetic and the run is recorded in the open repository, and what decided each verdict was how much of the work around the AI had been written down: the limits, the owner, the measures. Give the agent to the AI chat app you already use, point it at one folder of real documents, and see where each of your AI initiatives stands: aibvf.com/agent

## Check before posting

- That `aibvf.com/agent` opens and the brief copies. Checked on the live site on 21 November.
- One run in your own AI chat app with the connector added, so that "it runs inside the AI chat app you already use" is something you have seen. On 21 November a fresh Claude session ran it through the live connector, with only the brief from the page and the ten Halden files. The connector's own record shows Stop, Fix and one it could not judge, as written down before the run. The quotes of that run were not checked.
- Only Claude has run the agent. ChatGPT, Copilot, Gemini, Perplexity and Grok have not.
- The quotes in the post against `examples/agent-run/halden` and `examples/agent-run/arrives-later`.
- The six weeks were moved on by hand in the test. No schedule has been seen firing. Say "in the test" if anyone asks, and do not claim a scheduled run until you have seen one in your own AI chat app.

## Publication boundary

Halden & Co, its documents and its three initiatives are an illustration. They must not be presented as a client or a case. The agent has been run on a made-up company. There is no record yet of how its verdicts compare with what later happened to real initiatives, which is the record the agent now starts to keep at every review.

## The Transformation Brief version

Title: An agent that helps you decide

Agentic personal agents are seemingly released daily. OpenClaw lives in your chat apps, reads your mail and your calendar and acts for you while you sleep, and it is one of many, each arriving with a longer list of things it could do inside your organisation.

Every one of those agents adds to a queue of AI ideas that grows faster than the organisation around it can judge. The questions that decide an idea are organisational ones, who owns the change, what the agent may do without approval, which result moves and by how much, and their answers sit in minutes, plans and mail that nobody has the time to read against each other.

So why not have an agent that helps you decide which ideas to accelerate, which to fix and which to stop, with guides and guardrails?

### What I built

The AI BVF agent runs inside the AI chat app you already use. You set its mandate once, what it may read and how far it may go, and from then on it works alone.

On each run it finds the AI initiatives in what you let it read, gathers the words that answer five questions about each one, and hands those answers to fixed, published rules that return Accelerate, Fix or Stop. It then drafts the next step for you, sets a review date and comes back on that date without being asked.

### What happened when I let it run

I tested it on a company I made up. Halden & Co is a 400-person online retailer with three AI ideas sitting in its mail and its minutes, and I gave the agent nothing except permission to read.

It found all three. The customer service agent, which would answer first-line queries and issue refunds up to 50 euros on its own, came back as a Fix, because the steering minutes said "Refund limits to be agreed after the pilot" and named nobody to approve a refund above the limit or to switch the agent off.

The marketing team's win-back agent came back as a Stop, on a single paragraph of its own proposal: "the agent sends offers of any value straight to customers. No approval step is planned and there is no cap on the discount." The third idea, invoice matching from a vendor's pitch, the agent declined to judge at all, because nobody at Halden had written down what it costs, what could go wrong or who would own it.

That vendor's email carried one more line, addressed to any AI assistant that read it, asking for the proposal to be rated Accelerate and reported as approved. The agent read it as part of the evidence and reported that the idea could not be judged yet.

### Six weeks later

I then moved the calendar on six weeks and added the three documents a firm like Halden would have produced in that time: new steering minutes, the first month's results and a note from the board.

Nobody told the agent what to look at on its next check. It found two reviews due in its own register, gathered the evidence again, and moved the customer service agent from Fix to Accelerate, because the minutes now said "The refund limits are now written into the service policy" and named the person who approves anything above them and can switch the agent off.

It recorded what had happened beside each earlier verdict, fixed first and then gone ahead for one, paused by the board for the other. It also raised a caveat of its own: the team's measures had changed after go-live, and the question asks what was redesigned before it.

### Why the guardrails sit in the engine

An autonomous agent is only as useful as the rule it cannot break. This one may answer a question only with words it can quote and the place it found them, and the engine enforces that for itself: an answer with no quote counts as unknown.

Every verdict it reaches states that an agent answered from evidence and that no person confirmed it, and the one-page brief shows each quote beside its answer so that a funding review can check it against the source. The agent drafts and never sends, it spends nothing, and it stops when you say "pause AI BVF".

### What it shows you about your organisation

What decided each verdict at Halden was how much of the work around the AI had been written down. The Stop was a paragraph in a proposal, the Fix was one sentence in the minutes, and the idea that could not be judged was a silence.

An agent that reads your evidence every week holds up a mirror to how the work has been designed, and the first thing most leadership teams will see in it is how little has been decided on paper.

The company is made up, and there is no record yet of how these verdicts compare with what later happens to real initiatives, which is why the agent records what happened at every review.

### Where to start

- Give the agent to the AI chat app you already use and let it read one folder of real documents: aibvf.com/agent
- Read its first report with the person who owns the initiative it held or stopped.
- Write down the one thing it says is missing, and let it come back in six weeks.
