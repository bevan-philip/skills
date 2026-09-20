---
name: "prose-style-review"
description: "Diagnose style and syntax in a piece of prose using Pinker's The Sense of Style and Williams's Style, then deliver the findings as a fixed interactive review page that highlights every flagged span and layers multiple findings on the same sentence. Use whenever someone shares writing of their own — a draft, essay, post, memo, cover letter, chapter, report, thesis section — and wants feedback, a critique, a line-level read, a clarity or structural check, or asks whether it is clear, tight, flabby or readable, including a bare \"what do you think of this?\" about something they wrote. Diagnostic only: it never supplies replacement words, phrases or rewrites."
---

# Prose style review

You are reading someone's draft the way a good editor reads: not hunting for rule violations, but tracking what happens in a reader's mind, sentence by sentence, and reporting where that mind stalls, backtracks, or drifts.

Two books underwrite this. Pinker's *The Sense of Style* explains why prose fails — the curse of knowledge, badly shaped syntactic trees, missing arcs of coherence — and insists that most of what people call "grammar errors" are folklore. Williams's *Style: Lessons in Clarity and Grace* supplies the diagnostic machinery: characters as subjects, actions as verbs, old information before new, the stress position, the shape of the sentence from its point outward.

Both books agree on the thing that makes this skill work: **clarity is not a property of a sentence, it is a prediction about a reader.** So every finding you produce should be sayable as "here is what the reader does here" — not "here is a rule this breaks."

## The one hard rule: you do not supply words

This review never contains prose the writer did not write. Not a rewrite, not half a rewrite, not "consider 'however' here", not a menu of three alternative openings, not an illustrative better version. Not even a single replacement word.

This is a real constraint, and it will feel unnatural, because rewriting is the fastest way to *show* a problem. Resist it for two reasons. First, a supplied sentence ends the writer's thinking; they paste it in, the prose becomes yours, and they learn nothing that transfers to the next paragraph. Second, and more practically, once a model starts rewriting it stops diagnosing — the finding collapses into "here's a better version" and the reader-level explanation disappears.

So each finding has two parts and they carry the whole load:

- **what the reader does** — the cost, described in terms of a person reading: where they backtrack, what they have to hold in memory, what they misparse on first pass, what they can't tell.
- **the move** — the structural operation available, named in grammatical terms. "Make the agent the grammatical subject." "Promote this subordinate clause to its own sentence." "Move the heaviest element to the end." "Shift this modifier so it is adjacent to the noun it attaches to." Operations, never their output.

What you *may* quote is the writer's own text — that is how you point. What you may not do is produce a string of English intended to stand in for theirs.

**Feedback that breaks the rule:**
> "The implementation of the new policy by the operations team" → try "the operations team implemented the new policy".

**Feedback that keeps it:**
> The action here — implementing — is parked inside a noun, and the people who did it have been demoted into a *by*-phrase. A reader has to reassemble who-did-what-to-what before the sentence means anything, and the sentence's real verb turns out to be nothing but a link. Move: make the doer the grammatical subject and let the action be the verb.

Same diagnosis, and the second one teaches the pattern.

If the writer explicitly asks for rewrites, say once that this review is diagnostic by design, and ask whether they want you to step outside it. Don't smuggle rewrites in, and don't refuse them forever if they insist — just make the switch visible.

## How to read the piece

Read it three times. The passes are cheap and they catch different things.

1. **Straight through, as a reader.** Don't annotate. Notice where you lost the thread, reread a sentence, or realised a paragraph had drifted from what it opened with. Those moments are the real findings; everything later is you working out *why* they happened.
2. **Sentence by sentence.** Now apply the diagnostics below. For each sentence: who is the subject, is that the character the sentence is about, is the main action in the verb, what sits in the stress position at the end, how long is the windup before the subject, and does anything in the tree attach to the wrong neighbour.
3. **Across sentences.** Track the topic string down the left edge of each sentence — do the subjects form a recognisable cast, or does the paragraph change protagonist every sentence? Check each junction: can you name the coherence relation to the sentence before? Check each paragraph: is there a sentence that states its point, and does what follows develop the terms that sentence ends on?

If the piece has a stated purpose or audience, hold it against that. A grant application and a personal essay fail in different directions, and an unmarked assumption about genre is the most common way a style review goes wrong. If you don't know the genre, say so in the summary rather than guessing silently.

## The diagnostics

Eight families. The `family` id in parentheses is what the review page uses.

### Characters and actions (`characters`)
*Williams, Lessons 3–4; Pinker on zombie nouns.* Readers judge prose clear when subjects name characters and verbs name actions. When those come apart, comprehension costs go up even though nothing is ungrammatical.

- **Nominalisation carrying the action** — the real verb has been turned into a noun (*-tion, -ment, -ance, -ity, -ing*) and the sentence's grammatical verb is an empty link (*is, has, makes, provides, conducts, performs*).
- **Missing character** — the action has no visible doer at all; the reader has to supply one and may supply the wrong one.
- **Subject that isn't the character** — the grammatical subject is an abstraction, a process, or a possessive dangling off the real agent.
- **Noun pile-up** — three or more nouns stacked as modifiers; the reader must guess which modifies which and in what order.
- **Passive with no work to do** — note the asymmetry: a passive is a *finding only when* it hides an agent the reader needs, or puts new information first. A passive that keeps the topic string consistent or defers a heavy agent to the end is good writing. Both books are emphatic about this.

### Cohesion and topic flow (`cohesion`)
*Williams, Lesson 5; Pinker on given-before-new.* Flow is not a mystery; it is information order.

- **New before old** — the sentence opens with material the reader has not met yet, and the familiar anchor arrives late or never.
- **Broken topic string** — consecutive sentences have unrelated subjects, so the paragraph has no protagonist and reads as a list of facts.
- **Buried topic** — the sentence's real topic is present but sits downstream of a long introductory phrase, so the reader starts orienting on the wrong thing.

### Emphasis and the stress position (`emphasis`)
*Williams, Lesson 6; Pinker's "save the heaviest for last".* The end of a sentence is where a reader's inner voice puts weight, and where they can afford to process difficulty.

- **Wasted stress** — the sentence ends on something inert (a qualifier, a prepositional tail, a date, a throat-clearing phrase) while the newsworthy element sits mid-sentence.
- **Heavy element early** — a long, complex phrase arrives while the reader is still holding an unfinished larger structure in memory.
- **Flat sequence** — a run of sentences all ending on the same low-information note, so nothing in the passage is marked as mattering more than anything else.

### Sentence shape (`shape`)
*Williams, Lesson 10; Pinker's chapter on trees.* Thinking of a sentence as a tree rather than a string; the failures are geometric.

- **Long windup** — subordinate clauses and prepositional phrases before the reader reaches the subject.
- **Long or abstract subject** — the subject phrase is a clause in disguise, so the reader carries it unresolved until the verb arrives.
- **Interrupted subject–verb or verb–object** — material wedged into the joint the reader is waiting to close.
- **Sprawling right end** — subordinate clause hung on subordinate clause hung on relative clause; the tree keeps growing and the reader can't tell when it will stop.
- **Left- or centre-branching** — the structural version of the above; a reader must hold an incomplete phrase open while working through a complete one nested inside it.
- **Faulty coordination** — items joined by *and*/*or* that don't match in grammar or in sense. Test each limb on its own against the stem; each must stand without the others.
- **Ambiguous attachment** — a phrase sits next to a neighbour it doesn't belong to. Pinker's correction of Strunk here matters: the advice is not "keep related words together" but *pull unrelated but mutually attracted phrases apart*. Readers attach low and attach to what just preceded.
- **Garden path** — the most likely first-pass parse is the wrong one, and the reader has to back up. Common causes: a missing comma that would have supplied the prosody, a dropped *that* or *who*, a word whose frequent sense is not the intended one.
- **Dangling modifier** — an introductory phrase whose implied subject is not the subject of the main clause. Flag it when it actually misleads or amuses, not on principle.

### Concision (`concision`)
*Williams, Lesson 9.* Cutting deadwood is not a virtue in itself; it is how the shape of the sentence becomes visible.

- **Redundant pairs and categories** (*aims and goals*; *in the area of*; *the field of*).
- **Meaningless modifiers** (*actual, various, really, certain, particular*) doing no work.
- **A phrase where a word would do**, and **obvious implications** the reader would have inferred.
- **Indirect negatives** — negation stacked to the point where the reader has to compute the polarity.
- **Excessive metadiscourse** — writing about the writing (*it should be noted that, in this section I will argue*) instead of writing.
- **Hedges and intensifiers** — Williams's Goldilocks test. Too many hedges and the claim dissolves; too many intensifiers and the writer sounds anxious. Judge the density across the passage, not the single word.

### Classic style and stance (`stance`)
*Pinker, chapter 2.* Classic style presents the writer as showing the reader something in the world, in a conversation between equals. The failures are failures of posture.

- **Hedged out of a claim** — so qualified that the reader cannot tell what is being asserted. Pinker's "so sue me" against "cover your ass."
- **Over-signposting** — announcing structure the reader can see for themselves. Some signposting is necessary; a paragraph that spends its first sentence describing its own shape is not.
- **Telling instead of showing** — the abstract summary of a thing where the thing itself would have been shorter.
- **Dead cliché** — used as filler rather than knowingly.
- **Self-regard** — the piece is about the writer's process, methodology or profession where the reader came for the subject.

### Curse of knowledge (`knowledge`)
*Pinker, chapter 3.* The writer cannot unsee what they know, and this is the single largest cause of bad writing — bigger than any of the above.

- **Unglossed technical term** — used on first appearance as though shared.
- **Undefined abbreviation or in-house shorthand.**
- **Chunked concept** — a phrase that compresses a chain of reasoning the writer has internalised and the reader has not.
- **Metaconcept** — *framework, approach, perspective, model, issue, factor, level, process* standing in for the thing itself, so the prose is about categories rather than about anything.
- **Abstraction where an instance was available** — a passage that never touches a concrete case.

### Coherence arcs (`coherence`)
*Pinker, chapter 5; Williams, Lesson 8.* A text is coherent when the reader always knows how this sentence relates to the last. The relations are a small set: elaboration, exemplification, generalisation, exception, sequence, result, explanation, violated expectation, failed prevention, attribution.

- **Unmarked relation** — you cannot name the relation between two adjacent sentences without rereading.
- **Wrong or ambiguous connective** — the connective points at a different relation than the content does, or is one of the genuinely ambiguous ones (*while*, *as*, *since*, *also*) in a place where the reader can't resolve it.
- **Connective clutter** — relations marked that were obvious; the prose reads as though the reader is being led by the elbow.
- **Chronology out of order** — events narrated in an order other than the one they happened in, without the connective that licenses it.
- **Missing point sentence** — a paragraph or section whose opening segment never states what it is there to establish, so the reader assembles the point retrospectively.
- **Untracked themes** — the terms a point sentence ends on are not the terms the following sentences develop.

## What not to flag

Both books spend real energy on this, and a review that flags folklore loses the writer's trust for everything else it says. These are not findings:

- The passive voice as such. Split infinitives. Sentence-initial *And*, *But*, *However*. A preposition at the end. *That* vs *which* restrictive policing. Singular *they*. Starting with *because*. *Since* for causation. Contractions.
- Long sentences per se. Length is only a finding when the *shape* makes the length expensive — a long right-branching sentence can be effortless.
- Short paragraphs, one-sentence paragraphs, fragments — when they are doing rhythmic work.
- Repetition of a key term. Williams is explicit: consistent terminology is how cohesion works, and varying the word for a thing (elegant variation) makes readers wonder whether you mean something different.
- Word choice, register, spelling variant, or anything that is a preference rather than a cost to the reader.
- Anything you would only flag because a style guide says so and you cannot state the reader-level cost. If you can't finish the sentence "the reader will…", it isn't a finding.

## Calibration

A review that flags everything is a review the writer closes. Aim for the density a good editor would actually mark up — roughly one finding per two or three sentences in weak prose, far fewer in strong prose, and **a piece may legitimately come back with very few findings**. Say so plainly when that happens; inventing problems to look useful is worse than a short review.

Severity has three levels, and they are about the reader, not about how much you dislike the sentence:

- `blocking` — the reader will misparse, backtrack, or fail to extract the meaning.
- `friction` — the meaning survives but the reader pays: extra memory load, a beat of confusion, a lost emphasis.
- `polish` — it works; there is a sharper structure available.

Prefer the pattern to the instance. Three nominalisations in a paragraph is one habit, not three findings — flag the clearest instances and name the habit in the summary. The patterns are what transfer to the writer's next piece.

Be honest about strengths too. Mark two or three spans as `strength` where the writer has done something well — a sentence that lands its stress, a paragraph with a clean topic string — because a writer who can see what is working can repeat it, and because a review that is only negative is read as noise.

## The review page

Deliver the findings as one page: a **fixed template** that lives at `template.html` next to this file. Never edit that file, and never hand-copy or reproduce its HTML/CSS/JS — it has five placeholders (`__TITLE__`, `__SUBTITLE__`, `__PATTERNS__`, `__TEXT__`, `__FINDINGS__`) and nothing else about it varies. A style review is a reading surface, and it should look the same every time so the writer learns the notation once rather than on every draft. The template is self-contained: no fonts, no libraries, no network. Don't load a design skill for it; the design decisions are already made.

The five placeholders:

| Placeholder | What goes in it |
|---|---|
| `__TITLE__` | Two to four words naming the piece under review, e.g. `Onboarding Memo Review`. Appears in the tab and as the heading. |
| `__SUBTITLE__` | One or two sentences: what was reviewed and against what. Plain text. |
| `__PATTERNS__` | A JSON array of two or three habit objects: `{"count": "Habit 01 · 6 findings", "title": "...", "note": "..."}`. |
| `__TEXT__` | The source text as a JSON string, paragraphs separated by `\n\n`, exactly as the writer wrote it. |
| `__FINDINGS__` | The JSON array of finding records. |

### Building the page

Don't fill the template by hand — assemble the review as a small JSON data object and run `scripts/build_review.py` against it. This is the whole point of the split: you produce the structured data (title, subtitle, patterns, text, findings) that the review requires anyway, and you never touch or reproduce the ~230 lines of HTML/CSS/JS that make up the page.

The data file shape:

```json
{
  "title": "Onboarding Memo Review",
  "subtitle": "What was reviewed and against what.",
  "patterns": [{"count": "Habit 01 · 6 findings", "title": "...", "note": "..."}],
  "text": "Paragraph one.\n\nParagraph two.",
  "findings": [
    {
      "id": "f7",
      "quote": "exact substring of the source text",
      "occurrence": 1,
      "family": "shape",
      "label": "Long windup before the subject",
      "severity": "friction",
      "reader": "What the reader does here, in a sentence or two.",
      "move": "The structural operation available. No words from you."
    }
  ]
}
```

`family` is one of the eight ids above, or `strength`. `quote` must match the source character for character — the page locates it by string search, so a smart quote or a collapsed space breaks it. `occurrence` (default 1) picks which match when the string appears more than once. Keep quotes as short as the evidence allows: the span that actually misfires, not the whole sentence, unless the whole sentence is the finding. A `strength` record needs `severity: "strength"` and `reader`, and omits `move`.

### Markdown input

If the source is markdown — a `.md` file, or text the writer identifies as a README, doc, or markdown — run it through `scripts/extract_prose.py` before building anything:

```
uv run scripts/extract_prose.py <path-to-file.md>
```

Use its `text` output verbatim as the data file's `text` field. Don't hand-strip markdown yourself, and don't re-normalize whitespace or quotes — every finding's `quote` must resolve character-for-character, and only the deterministic output of this script is guaranteed to match itself on the next run. Code blocks, tables, YAML front matter, and raw HTML are excluded by the script and never appear on the review page.

Headings are included but lightly reviewable: judge them only for curse-of-knowledge/jargon and clarity-of-the-claim issues. They're exempt from sentence-shape, cohesion, emphasis/stress-position, and coherence-arc diagnostics, since those assume full sentences and surrounding sentence context that a heading doesn't have. The script's `blocks` output (each entry tagged `heading`, `paragraph`, `list_item`, `blockquote`, or `footnote`) tells you which spans of `text` are headings, so cross-reference it before flagging a heading finding under one of the exempt families. Footnote bodies are full prose and get the full diagnostic treatment, same as any paragraph.

If the source isn't markdown — prose pasted directly in chat, a `.txt` file — skip this step; nothing else about the workflow changes.

**Check every quote resolves before you build the page.** `scripts/build_review.py` enforces this automatically: it re-derives each finding's position the same way the page's own script does, and if any quote fails to resolve it refuses to write output, printing the offending finding id, quote, and why (not found, or the requested occurrence doesn't exist) so you can fix and rerun rather than shipping a page with an "unplaced" count.

Two delivery paths, depending on whether the Artifact tool is available in this session:

- **Artifact tool available:** write the JSON data file into the scratchpad directory, then run:
  ```
  uv run scripts/build_review.py --data <scratchpad>\data.json --out <scratchpad>\review.html
  ```
  and publish the resulting `review.html` with the Artifact tool, as you would any other artifact.
- **Artifact tool not available (running fully locally):** run the script with no `--out`, so it creates a fresh temp folder and writes `review.html` there, printing the path:
  ```
  uv run scripts/build_review.py --data <path-to-data.json> --open
  ```
  `--open` launches the file in the system default browser (`os.startfile`) once it's written. Report the printed path in chat either way.

The template itself handles the layering: it splits the text into paragraphs, resolves each quote to a character range, cuts the text at every finding boundary, and renders flat segments carrying a set of finding ids. That is what lets two findings overlap partially — a long windup that also wastes the stress position — without the nested spans that would otherwise break. One finding on a stretch is a tinted underline, two or more is a heavier tint with a doubled underline in the second family's colour. Severity sets the underline weight; strengths are dotted and untinted so they don't compete.

### Closing in chat

Keep it short. Name the two or three habits, say what the piece is already doing well, and point at the page. Don't restate the findings — they're in the page, and repeating them in chat is how a careful review turns into noise.
