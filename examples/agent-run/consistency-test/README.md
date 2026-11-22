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

Two Claude models have answered, as `claude a` and `claude b`. See [`results.md`](results.md). Replies from other assistants are added as they are run.

Halden & Co is a made-up company.
