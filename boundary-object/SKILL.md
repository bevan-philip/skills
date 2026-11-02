---
name: boundary-object
description: Share a plan or an implementation report with the human as an interactive local web page (a "board") of diagrams, decisions, assumptions, editable steps, mockups and diffs, and get their picks, edits and comments back as a structured digest. Use when a non-trivial change needs the human's decisions or sign-off before you build it, when reporting back on a substantial change, or when the user asks for a board, a visual plan or boundary objects.
---

# Boundary object

A plan written as a long Markdown message serves the agent's needs, not the human's. You can produce text far faster than they can read it, and a reply in chat can't point at the thing it is about. A *boundary object* is a shared artifact that both sides read in their own way. You see a structured `doc.json`. The human sees a page of diagrams, choices and steps they can click on, edit and annotate. Each side edits only its own file, and both refer to the same ids.

This skill gives you that artifact: a local web app (TanStack Start + React + shadcn/ui) that renders your `doc.json` and records the human's feedback, plus a CLI that delivers that feedback back to you. The board is where the human thinks with you, not a document they sign: they can pick, edit and tune, send you off to find something out, or hand a decision back to you.

## When to use it

Use a board when the human's input changes what you build, and the input is easier to give by looking than by reading:

- **Planning** a change that has real decisions in it: architecture, data model, UX, scope, ordering, risky migrations.
- **Reporting** after a substantial change. Show what you built against the plan, what deviated and why, and what the human should check.

Don't use one for a quick question you could ask in a sentence, a one-file fix, or anything the human said to just do. A board costs the human a context switch; it has to save them more than that. If a picture would still help with a small question, put it in chat: a call tree, a file tree or a Mermaid diagram in a fenced block costs the human nothing to open.

## The CLI

Every command is `node <this skill's directory>/scripts/boundary.mjs <command>`; below, `boundary` stands for that. It needs Node 22.12 or newer. On first use it installs and builds the app in `app/`, which takes about a minute. Each board lives in its own directory under the system temp directory, never in the project or in this skill's directory. `boundary new` creates it and prints its id and paths. Every other command takes that id and works from any directory.

| Command | What it does |
| --- | --- |
| `boundary new <name> [--kind plan\|report] [--title "…"]` | Starts a board for this invocation. Prints its id (your name plus a short suffix, e.g. `session-store-k3x9`), the path of its `doc.json` and its `assets/` folder. |
| `boundary open <id>` | Starts the project's board server if needed, validates the doc, prints the URL, and opens a browser when there is a display. |
| `boundary check <id>` | Validates `doc.json` after you edit it and prints each problem with its path (`blocks.3(storage).options: …`). |
| `boundary wait <id> [--timeout 1800]` | Blocks until the human sends a round, then prints the digest. Exit code 2 means it timed out with nothing new. |
| `boundary feedback <id> [--round N \| --state]` | Reprints a round, or the standing answer to every question so far. |
| `boundary list` / `boundary stop` | Lists all boards with the project each was started from, or stops the server. |
| `boundary demo` | Copies the example boards in and opens them, for when the user wants to see what a board looks like. |

The page updates live whenever `doc.json` changes, so you never need to tell the human to reload.

## Workflow

1. **Explore first.** Read the code until you can state the current state, the change, and the open questions. Don't ask the human anything the codebase can answer.
2. **Write the board.** Run `boundary new <name>` once for this invocation and keep the id it prints. Write the `doc.json` at the path it prints, following [references/blocks.md](references/blocks.md); read that file before writing your first board. Copy any image the board shows into the printed `assets/` folder. Never write board files into the project or into this skill's directory.
3. **Check and open.** Run `boundary check <id>` until it passes, then `boundary open <id>`.
4. **Tell the human in one or two lines** what the board is for and what you need from them, and give the URL. Don't repeat the board's content in chat.
5. **Wait.** Run `boundary wait <id> --timeout 3600`. If your harness can run a command in the background and wake you when it exits, as Claude Code's Bash tool can with `run_in_background`, do that and end your turn. Otherwise run it in the foreground with a timeout below your tool's limit and re-run it on exit code 2. The page shows the human whether you are listening. Feedback they send while you aren't is kept and handed over on your next `wait`.
6. **Act on the digest** (see below). Revise `doc.json`, run `check`, then `wait` again. Repeat until the human approves.
7. **After approval, build.** Then start a **report** board with `boundary new <name>-report --kind report`, which gives the report its own id. Use the same steps and the same open-and-wait loop.

If the human replies in chat instead of on the board, treat that as feedback too. Run `boundary feedback <id> --state` when you need to recall what was decided.

## What a good board looks like

The human's attention is the budget. A good board can be reviewed in under five minutes, with depth available on demand.

- **Lead with the ask.** The `summary` is two to four sentences: what you will change, why, and what you need from them. Set `status` to a single sentence about where you are ("Plan ready, no code changed yet.").
- **Turn silent choices into visible ones.** Every place you would otherwise pick something yourself is a `decision` with your recommendation and what each option costs in the human's terms. Every belief you are acting on but haven't verified is a `confirm` item. These two blocks are where most of a plan's risk gets caught.
- **Ask only what changes the build.** A long run of questions wears the human down until they accept every default unread. Keep it to the few decisions that matter, set `reversible` on each so they can see which ones are hard to undo, and turn low-stakes choices into `confirm` items ("I'll use X unless you say otherwise").
- **Find out instead of guessing.** Your time is cheap and the human's attention isn't. When a decision turns on something you can test (speed, how many call sites change, whether a library handles a case), try the options before you ask: a scratch branch, a worktree or a subagent per option. Put what you saw on each option as `evidence`, and the numbers as `metrics` so the page lines the options up in one table. A choice between measured results is much easier than a choice between predictions.
- **Draw before you write.** People take in a picture far faster than prose, and they can point at it. Give every plan at least one diagram of what changes, and prefer a picture to a paragraph wherever there is structure:
  - components and data flow: `diagram`, with nodes and edges marked `added` / `changed` / `removed`
  - states and lifecycles (a session, an order, a job, a UI component): a Mermaid `stateDiagram-v2`, or a `diagram` using the `state`, `start` and `end` kinds
  - branching logic (auth checks, retries, validation): a Mermaid `flowchart` with `{decision}` diamonds
  - an interaction over time: a Mermaid `sequenceDiagram`
  - comparing options: `metrics` on the decision's options, or a `table`
  - order of work: `steps`
  - logic or an algorithm: pseudocode in a `code` block
  - runtime control flow: a call tree in a `code` block, indented by call depth
  - UI structure: a component tree in a `code` block, with the file each component lives in and the hooks or state that matter
  - what each file or module owns, or a broad refactor: a shallow file tree in a `code` block, with a `# comment` per entry
  - a change to any of those: the same shape in a `code` block with `"language": "diff"`, marking new lines `+` and removed lines `-`
  - anything with a UI: `mockup` (plan) or `image` screenshot with `before` (report)
  - a value on a scale (spacing, shadow, timing, colour): a `mockup` with `controls`, so the human tunes it instead of choosing between three guesses
  - an interface, schema or config the human must agree to: `code`
  - prose only where nothing else fits: `markdown`
- **Pick the smallest view that makes the point.** A six-line call tree often says more than a diagram of the same calls, and it is quicker to comment on line by line. When the shape already exists and the point is what changes, show it as a diff in the shape of the topic: a component-tree diff for a UI change, a file-tree diff for a reshuffle, a call-tree diff for a new hop, a pseudocode diff for new control flow. Show the whole shape instead when most of it is new, when leaving out the context would hide who owns what or what runs in which order, or when the human needs the target shape to copy. A question needs one or two views, not every kind of block the board supports.
- **One question per diagram.** Keep each diagram to about 15 nodes and give it a title that says what to look at ("What the auth middleware talks to now"). Two small diagrams beat one that shows everything.
- **Show the change, not the whole system.** Mark what you add, change and remove, and keep only the calls, files, props, states and boundaries the question turns on. In a report, list files with a one-line summary each, and include a diff only for the hunks a reviewer should actually read.
- **Keep the words next to the picture.** The sentence that tells the human what to look at goes in the block's `note`, not in a `markdown` block above it.
- **Make mockups look like the product.** Take colours, type, spacing and component styles from the project's CSS or design tokens, and use real labels and data, not placeholder text. The human can react to a faithful sketch; a grey wireframe makes them imagine the result.
- **Progressive disclosure.** Put rationale in `detail` fields (nodes, steps) and set `collapsed: true` on reference blocks. The top of the page holds the questions and the headline.
- **Group with `section` blocks.** Three to five sections, ordered by what the human must do first ("Decisions I need from you" before "How I'll do it").
- **Stable ids.** Ids are how feedback finds its way back. Never rename an id between revisions; change the content instead. The page diffs each revision against what the human last saw. Changed blocks are marked *updated* and new ones *new*, and so are the steps, options and rows inside them; removed blocks and items are listed. The human only re-reads what moved.

## Acting on feedback

The digest names every item by id with its label resolved. Its verdict line says what to do next (APPROVED: build; CHANGES REQUESTED: revise and wait again; COMMENTS ONLY: answer and wait again), and it ends with a **How to respond** section covering each kind of item in that round. Follow that section. Across rounds:

- **Revise in place.** Keep every id, update `status`, and set `changeNote` on each block you change. Reply to every comment in `replies`.
- **Answered decisions stay answered.** Changing a decision's `question`, or an option's `label`, `summary`, `pros` or `cons`, reopens it and the human answers again; `check` refuses that without a `changeNote` saying why. Adding `evidence`, `metrics` or `context`, or moving `recommended`, keeps their answer.
- **Never edit `feedback.json`**; it belongs to the page. `doc.json` belongs to you.

## Report boards

A report answers "did we get what we agreed?" Use the same building blocks:

- `steps` copied from the plan, each with a `status` (`done`, `changed`, `skipped`, `blocked`) and a `note` explaining any deviation.
- `files` with a summary per file, and diffs (as `diffSrc` files) for the parts worth reading.
- Screenshots of anything visual (take them with Playwright if it's available), using `before` on the image block for before/after comparisons.
- A `confirm` block titled "Please check" listing what the human should verify by hand, each item written as something they can do.
- Follow-ups and known gaps as a `callout`.

## Practical notes

- **Put long text in files, not JSON strings.** Anything more than a few lines goes in `assets/` and is referenced by path: `diffSrc` on a `files` item (`git diff -- src/auth.ts > assets/auth.diff`), `src` on `code` and `mermaid` blocks, and `src` on a `mockup`. You write no escaping and don't retype text that already exists. The page picks up edits to `diffSrc` and `src` files by itself.
- Images and mockup files reload when `doc.json` changes. If you replace one in place, save `doc.json` in the same revision (updating `status` is enough).
- `check` parses every `mermaid` block (with [Pele](https://pele.run)) and reports syntax errors with a line and column, so a broken diagram never reaches the human.
- Don't size or position diagram boxes yourself. The page measures every label and lays the graph out, so all you choose is what's in it.
- The server binds to 127.0.0.1. In a remote or headless environment, give the human the URL and say they need a port-forward to reach it.
