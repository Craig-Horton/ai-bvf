# A funding review, both visits

A verdict says whether an AI initiative is ready to go ahead. The person who holds the budget needs three more things: what is being asked for the next stage, what the alternative is, and what result would release more money.

The funding record holds those. It sits beside the verdict and never changes it. Every figure in it is the organisation's own, and the engine never says whether to fund.

## The example

A made-up software firm of 180 people wants GenAI to sort its service desk tickets. The team asks for €5,000 to run a pilot.

Before the pilot the sponsor agrees two results. Cost per resolved ticket has to fall from €12 to €10 or less. Reopened tickets have to stay at 6 percent or less.

After the pilot the cost is €9.50 and reopened tickets are at 10 percent.

```bash
npm run build
node examples/funding-review/run.mjs
```

## What the engine says

Before the pilot:

> The next stage is a pilot. The ask is €5,000. The alternative: Rewrite the ticket form so customers pick the team themselves. Two results are agreed for the review.

After the pilot:

> Two results were agreed on 23 November 2026. One is met and one is not. Not met: Reopened tickets, at most 6 percent agreed, 10 percent measured.

The verdict is Fix on both visits. A result against an agreed figure does not move it.

## How the agreement survives six weeks

Nothing is stored. The first verdict comes with a brief link, and the ask and the two agreed results travel inside it. At the return visit the caller passes that link and what was measured. The engine reads the agreement back out of the link and sets the results beside it.

Results passed at the return visit never replace the earlier agreement without that being said. Where they differ, the engine checks against the earlier ones and says so.

## What it does not do

- It works out no figure. A cost per ticket is the organisation's count, repeated with its source.
- It does not say fund or do not fund. It says which agreed results are met.
- It does not check that the agreed results were the right ones to agree.
