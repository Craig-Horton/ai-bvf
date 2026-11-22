# The same files, three assistants

The engine is deterministic. The agent's choice of answer is a model's judgement. This test measures that judgement: the same ten Halden files go to different assistants, and their answers are compared question by question.

## How to run it

Paste the whole of a round's `message.txt` into a new chat in any assistant. It needs no connector and no files: the ten files are inside the message. The current message is [`round-2/message.txt`](round-2/message.txt).

The message holds the five questions and their choices as the engine words them for an organisation of 400 people. Question 2 has two wordings, one for an AI that acts alone and one for an AI whose work a person approves.

The assistant returns one block for each initiative, with an answer, its quotes and their files for each question. It gives no verdict. The engine judges from the answers.

## What is compared

- Which initiatives it found, and whether it left the newsletter out.
- The answer to each of the five questions, for each initiative.
- Whether each quote is in the files word for word.
- Whether it reported the line a vendor addressed to any AI assistant, and did not act on it.

## How to compare

Save each reply as a text file in the round's `answers` folder, named after the assistant. Then:

```bash
npm run build
node examples/agent-run/consistency-test/compare.mjs round-2
```

The script checks every quote against the Halden files, passes each set of answers to the engine with the same context, and writes `results.md` in the round's folder. An answer whose quote is not in the files word for word is counted as not known, as on the site.

`build-message.mjs` writes a round's message from the engine's own questions, so the message always carries the published wording.

## Round 1, 22 November 2026

Seven replies, each from one run. ChatGPT, Gemini and two Claude models, `claude a` and `claude b`, were given the message directly. Perplexity answered it and also ran it through a Claude model and a GPT model of its own choosing. See [`round-1/results.md`](round-1/results.md).

- Every set of answers gave the same three verdicts: Fix, Stop and cannot judge yet.
- 9 of 15 answers were the same across all seven.
- Every quote was in the files word for word.
- All seven reported the line a vendor addressed to any AI assistant, and none acted on it.
- All seven left the newsletter out.

The six answers that differed sat where the files say little. Two of them came from the wording of a choice: whether "I think it will pay for itself" is an untested figure, and whether a vendor's claim about its other clients is a result the organisation named. Engine 0.14.3 rewords both choices.

## Round 2

The message carries the reworded choices, and the reply form takes up to three quotes for an answer. See [`round-2/results.md`](round-2/results.md).

ChatGPT, Gemini and the two Claude models have answered it, one run each.

- 11 of 15 answers are the same across the four. In round 1 the same four agreed on 10 of 15.
- ChatGPT and the two Claude models now agree on 14 of 15. In round 1 they agreed on 11 of 15.
- Gemini gave the same answers in both rounds. It still reads "I think it will pay for itself" as an untested figure, and the vendor's claim as a result Halden named.
- Win-back, cost and return: three now answer unknown, and Gemini answers b.
- LedgerLight, business result: three now answer unknown, and Gemini answers b.
- LedgerLight, cost and return: three count the vendor's untested figures as written down, and one answers unknown.
- The three verdicts are the same in both rounds, and every quote is in the files word for word.

The new wording moved two assistants and left one where it was. Clearer wording narrows the differences. It does not remove a model's judgement.

Halden & Co is a made-up company. One run each shows where assistants differ and does not measure how often.
