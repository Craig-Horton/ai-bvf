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

## Round 3, the return visit

Round 3 tests two rules that came from a reader's question. What happens when the board minutes say one thing and the service policy says another, and can the tool explain why a verdict changed?

The message is the return visit on 4 January. It carries 14 files: the ten from November, the three in [`arrives-later`](../arrives-later), and one new record in [`conflicting-record`](../conflicting-record). The minutes of 10 December name a person who approves refunds above the limits. Service policy version 5, in force from 15 December, still has the agent pay a repeat contact in full with no person.

The reply form has one new line. Where another file says otherwise than an answer, the assistant quotes it under that answer as `Q2 AGAINST`. It is told to pick no winner, and that a later file which reports a change replaces the earlier one.

The script passes those words to the engine as `evidence_against`. The same assistant's round 2 answers stand for its first visit on 23 November: their brief link goes back in as `review.previous_brief`, and the engine says what changed.

[`round-3/expected.md`](round-3/expected.md) was written before any reply came in. See [`round-3/results.md`](round-3/results.md).

Two Claude models have answered it, one run each.

- Both quoted the service policy against the refund agent's answer on risk and control. Neither marked the November minutes as a disagreement.
- The engine held that answer in both and gave no verdict on the refund agent. It returned both sets of quotes and asked which one applies today.
- Once the owner confirms the answer given, one reply reaches Accelerate and the other Fix. They differ on one answer: whether the team's measures, changed after go-live, count as redesigned.
- For the reply that reaches Accelerate the engine says: "The verdict moved from Fix to Accelerate. Three answers changed since 23 November 2026. The verdict needed each of these changes: Risk and control, Redesign of the work."
- The win-back agent is Stop on both visits, with no answer changed.

This is one made-up conflict, placed where an assistant would look, and two replies from one vendor's models. It shows the rule works when the assistant finds both records. It does not show how often an assistant misses the second record in a real organisation's files.

