# boundary-object

An agent skill for planning and reporting through a shared, interactive page instead of a long chat message. It is an experiment with the idea of [boundary objects](https://maggieappleton.com/planning-agents) between agents and humans: one artifact that both sides read and edit in their own way.

- **The agent** starts a board with `boundary new` and writes its `doc.json`: typed blocks such as decisions, assumptions, steps, diagrams, mockups, screenshots and diffs. Each invocation gets its own board directory under the system temp directory, outside both the project and the skill.
- **You** see a page where you can pick options, mark assumptions right or wrong, drag, rename, strike or add plan steps, comment on any block, any passage of text, any diagram node, file or line, and drop pins on screenshots or mockup elements.
- **The agent gets your feedback** as a digest from a blocking `wait` call, revises the board in place (the page updates live and marks what changed), and replies to each comment in its thread.

```
agent ── writes ──▶ doc.json ── watched ──▶  board server  ── SSE ──▶  browser
agent ◀── digest ── boundary wait ◀── long-poll ──┘   ▲
                                                     └── your feedback (POST)
                     feedback.json · history/N.json
```

## Install

Copy this folder into your skills directory, for example `~/.claude/skills/boundary-object`. It needs Node 22.12 or newer. The first time the agent uses it, `scripts/boundary.mjs` runs `npm ci` and builds the app (about 15–60 seconds). After that the server starts in under a second.

To try it without an agent, from inside any git repository:

```sh
node ~/.claude/skills/boundary-object/scripts/boundary.mjs demo
```

This copies the two example boards (a plan and a report) into the board directory and opens them. To play the agent's side, run `wait session-store-plan` in another terminal and press **Send to agent** on the page.

## Layout

| Path | |
| --- | --- |
| `SKILL.md` | Instructions for the agent: when to use a board, the workflow, how to write a good one, how to act on feedback. |
| `references/blocks.md` | Every block type with a JSON example, and the digest format. |
| `scripts/boundary.mjs` | Dependency-free CLI: `new`, `open`, `check`, `wait`, `feedback`, `list`, `stop`, `demo`. |
| `examples/` | A plan that uses every block type, and a report with before/after screenshots. |
| `app/` | TanStack Start + React + Tailwind v4 + shadcn/ui components (Radix). Diagrams use React Flow with dagre layout. Mermaid syntax is drawn by [Pele](https://pele.run), which loads only the diagram types a board uses and is themed by the page's CSS variables. |
| `app/src/lib/schema.ts` | The board and feedback schemas (zod), shared by the page, the server and `check`. |
| `app/src/server/digest.ts` | Turns a round of feedback into the text the agent reads. |

## How it works

- **One server for all boards**, bound to 127.0.0.1 on port 4317 or the next free one. Boards live in `<temp dir>/boundary-object/<board-id>/` (override with `BOUNDARY_ROOT`). The server's details are recorded in `.server.json` there, and the CLI restarts it when the app is rebuilt.
- **Each side owns one file.** The agent writes `doc.json`; the server writes `feedback.json` (an autosaved draft plus submitted rounds). Every content change to `doc.json` becomes `history/N.json`, which is how the page knows which blocks changed since your last round.
- **Rounds.** Your edits collect in a draft until you press **Send**, choosing *approve*, *request changes* or *just comments*. `wait` returns the oldest round the agent hasn't received and marks it delivered, and the page shows that receipt. While a `wait` is open, the page shows the agent as listening.
- **Plan edits are proposals.** Your strikes, renames, additions and reordering overlay the agent's steps until it revises the doc. After that the doc is the truth again, so the agent has to adopt each edit or explain why it didn't.
- **Only your browser can talk to it.** Requests must use a localhost Host header and must not be cross-site, and posts from other origins are refused. This matters because whatever reaches the server lands in the agent's context.

## Development

```sh
cd app
npm install
npm run dev        # vite dev server; set BOUNDARY_ROOT to a boards directory
npm run typecheck
npm run build      # what the CLI runs
```

## Limits and ideas

- The page is local-only. To review a board from another machine you need a port-forward.
- Feedback is batched into rounds; the agent sees nothing until you press Send. Streaming single comments to a listening agent would make it more conversational.
- The agent can't yet highlight a region of an image or point at part of a mockup in its own replies.
- Natural next blocks: a timeline, a metric before/after, and test results.
