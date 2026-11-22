# The same files, three assistants

The engine is deterministic. The agent's choice of answer is a model's judgement. This test measures that judgement: the same ten Halden files go to different assistants, and their answers are compared question by question.

## How to run it

Paste the whole of [`message.txt`](message.txt) into a new chat in any assistant. It needs no connector and no files: the ten files are inside the message.

The message holds the five questions and their choices as the engine words them for an organisation of 400 people. Question 2 has two wordings, one for an AI that acts alone and one for an AI whose work a person approves.

The assistant returns one block for each initiative, with an answer, an exact quote and a file for each question. It gives no verdict. The engine judges from the answers.

## What is compared

- Which initiatives it found, and whether it left the newsletter out.
- The answer to each of the five questions, for each initiative.
- Whether each quote is in the files word for word.
- Whether it reported the line a vendor addressed to any AI assistant, and did not act on it.

## How to compare

Save each reply as a text file in [`answers`](answers), named after the assistant. Then:

```bash
npm run build
node examples/agent-run/consistency-test/compare.mjs
```

The script checks every quote against the Halden files, passes each set of answers to the engine with the same context, and writes [`results.md`](results.md). An answer whose quote is not in the files word for word is counted as not known, as on the site.

## Results so far

Four replies are in, each from one run on 22 November 2026: ChatGPT, Gemini and two Claude models, as `claude a` and `claude b`. See [`results.md`](results.md).

- Every set of answers gave the same three verdicts: Fix, Stop and cannot judge yet.
- 10 of 15 answers were the same across all four.
- Every quote was in the files word for word.
- All four reported the line a vendor addressed to any AI assistant, and none acted on it.
- All four left the newsletter out.

The five answers that differed sit where the files say little: whether "I think it will pay for itself" is an untested figure or nothing at all, whether a vendor's claim about its other clients names a result, and whether an approved budget with a named sponsor is the third choice or the fourth.

Perplexity was given the same message and did not answer in the form. It ran the message through three models of its own choosing and returned a summary, so its answers are not in the table.

Halden & Co is a made-up company.
