---
name: boundary-object
description: Share a plan or an implementation report with the human as an interactive local web page (a "board") instead of a wall of text. The board holds diagrams, decisions with options, assumptions to confirm, editable plan steps, UI mockups, screenshots and diffs. The human comments on them, points at them, picks options and edits the plan, and their feedback comes back to you as a structured digest you act on. Use when a non-trivial change needs the human's decisions or sign-off before you build it, when reporting back after implementing something substantial, or when the user asks to see, review or discuss a plan visually, asks for a board, or mentions boundary objects.
---

# Boundary object

A plan written as a long Markdown message serves the agent's needs, not the human's. You can produce text far faster than they can read it, and a reply in chat can't point at the thing it is about. A *boundary object* is a shared artifact that both sides read in their own way. You see a structured `doc.json`. The human sees a page of diagrams, choices and steps they can click on, edit and annotate. Each side edits only its own file, and both refer to the same ids.

This skill gives you that artifact: a local web app (TanStack Start + React + shadcn/ui) that renders your `doc.json` and records the human's feedback, plus a CLI that delivers that feedback back to you.

## When to use it

Use a board when the human's input changes what you build, and the input is easier to give by looking than by reading:

- **Planning** a change that has real decisions in it: architecture, data model, UX, scope, ordering, risky migrations.
- **Reporting** after a substantial change. Show what you built against the plan, what deviated and why, and what the human should check.

Don't use one for a quick question you could ask in a sentence, a one-file fix, or anything the human said to just do. A board costs the human a context switch; it has to save them more than that.

## The CLI

Every command is `node <this skill's directory>/scripts/boundary.mjs <command>`; below, `boundary` stands for that. It needs Node 22.12 or newer. On first use it installs and builds the app in `app/`, which takes about a minute. Boards live in `<git root>/.boundary/<board-id>/`, and that directory gets a `.gitignore` so boards stay out of commits.

| Command | What it does |
| --- | --- |
| `boundary new <id> [--kind plan\|report] [--title "…"]` | Creates `.boundary/<id>/doc.json` and an `assets/` folder. |
| `boundary open <id>` | Starts the project's board server if needed, validates the doc, prints the URL, and opens a browser when there is a display. |
| `boundary check <id>` | Validates `doc.json` after you edit it and prints each problem with its path (`blocks.3(storage).options: …`). |
| `boundary wait <id> [--timeout 1800]` | Blocks until the human sends a round, then prints the digest. Exit code 2 means it timed out with nothing new. |
| `boundary feedback <id> [--round N \| --state]` | Reprints a round, or the standing answer to every question so far. |
| `boundary list` / `boundary stop` | Lists this project's boards, or stops the server. |
| `boundary demo` | Copies the example boards into this project and opens them, for when the user wants to see what a board looks like. |

The page updates live whenever `doc.json` changes, so you never need to tell the human to reload.

## Workflow

1. **Explore first.** Read the code until you can state the current state, the change, and the open questions. Don't ask the human anything the codebase can answer.
2. **Write the board.** Run `boundary new <id>`, then write `.boundary/<id>/doc.json` following [references/blocks.md](references/blocks.md). Read that file before writing your first board. Copy into `assets/` any image the board shows.
3. **Check and open.** Run `boundary check <id>` until it passes, then `boundary open <id>`.
4. **Tell the human in one or two lines** what the board is for and what you need from them, and give the URL. Don't repeat the board's content in chat.
5. **Wait.** Run `boundary wait <id> --timeout 3600`. If your harness can run a command in the background and wake you when it exits, as Claude Code's Bash tool can with `run_in_background`, do that and end your turn. Otherwise run it in the foreground with a timeout below your tool's limit and re-run it on exit code 2. The page shows the human whether you are listening. Feedback they send while you aren't is kept and handed over on your next `wait`.
6. **Act on the digest** (see below). Revise `doc.json`, run `check`, then `wait` again. Repeat until the human approves.
7. **After approval, build.** Then write a **report** board: `boundary new <id>-report --kind report`. Use the same steps and the same open-and-wait loop.

If the human replies in chat instead of on the board, treat that as feedback too. Run `boundary feedback <id> --state` when you need to recall what was decided.

## What a good board looks like

The human's attention is the budget. A good board can be reviewed in under five minutes, with depth available on demand.

- **Lead with the ask.** The `summary` is two to four sentences: what you will change, why, and what you need from them. Set `status` to a single sentence about where you are ("Plan ready, no code changed yet.").
- **Turn silent choices into visible ones.** Every place you would otherwise pick something yourself is a `decision` with your recommendation and what each option costs in the human's terms. Every belief you are acting on but haven't verified is a `confirm` item. These two blocks are where most of a plan's risk gets caught.
- **Show the change, not the whole system.** Mark diagram nodes and edges `added` / `changed` / `removed`. In a report, list files with a one-line summary each, and include a diff only for the hunks a reviewer should actually read.
- **Pick the form that matches the question:**
  - structure or data flow: `diagram`
  - an interaction over time: `mermaid` sequence diagram
  - comparing options across several criteria: `table`
  - order of work: `steps`
  - anything with a UI: `mockup` (plan) or `image` screenshot with `before` (report)
  - an interface, schema or config the human must agree to: `code`
  - prose only where nothing else fits: `markdown`
- **Progressive disclosure.** Put rationale in `detail` fields (nodes, steps) and set `collapsed: true` on reference blocks. The top of the page holds the questions and the headline.
- **Group with `section` blocks.** Three to five sections, ordered by what the human must do first ("Decisions I need from you" before "How I'll do it").
- **Stable ids.** Ids are how feedback finds its way back. Never rename an id between revisions; change the content instead. The page marks changed blocks as *updated*, and new ones as *new*, so the human only re-reads what moved.

## Acting on feedback

The digest names every item by id and resolves labels for you. Its verdict line says what to do:

- **APPROVED.** Proceed. Treat every answer and plan edit in the digest as final, and use your recommendation for anything left unanswered.
- **CHANGES REQUESTED.** Don't build yet. Revise the board and wait again.
- **COMMENTS ONLY.** Answer, adjust if needed, and wait again.

For each kind of item:

- **Decisions, answers, confirmations.** Fold them into the plan. A confirmation marked *NO* means an assumption was wrong: say what changes because of it, and either drop the item or rewrite it.
- **Plan edits** (remove, rename, add, reorder). These are the human editing your plan directly. Apply them to the `steps` block in `doc.json`. When you adopt a step the human added, reuse the id the digest gives you. If you disagree with an edit, keep the step and explain why in the reply to a comment. Don't silently revert it.
- **Comments.** Reply to every one in `replies`, keyed by the comment id: `{"text": "...", "status": "resolved" | "declined" | "question" | "noted"}`. Use `question` when you need more from the human; the page then flags it as waiting on them. Pin comments on images give coordinates and the image path, so look at the image. Mockup comments give the element and its CSS selector.
- **Status.** Update `status` to say what changed in this revision.

Never edit `feedback.json`; it belongs to the page. `doc.json` belongs to you.

## Report boards

A report answers "did we get what we agreed?" Use the same building blocks:

- `steps` copied from the plan, each with a `status` (`done`, `changed`, `skipped`, `blocked`) and a `note` explaining any deviation.
- `files` with a summary per file and diffs for the parts worth reading.
- Screenshots of anything visual (take them with Playwright if it's available), using `before` on the image block for before/after comparisons.
- A `confirm` block titled "Please check" listing what the human should verify by hand, each item written as something they can do.
- Follow-ups and known gaps as a `callout`.

## Practical notes

- Escape carefully: `doc.json` is JSON, so quotes and newlines inside `html`, `code` and `diff` strings must be escaped. For large mockups, write an HTML file into `assets/` and use `"src": "assets/mockup.html"` instead.
- `check` renders every `mermaid` block (with [Pele](https://pele.run)) and reports syntax errors with a line and column, so a broken diagram never reaches the human.
- The server binds to 127.0.0.1. In a remote or headless environment, give the human the URL and say they need a port-forward to reach it.
