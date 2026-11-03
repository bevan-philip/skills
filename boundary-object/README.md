# boundary-object

An agent skill for planning and reporting through a shared, interactive page instead of a long chat message. It is an experiment with the idea of [boundary objects](https://maggieappleton.com/planning-agents) between agents and humans: one artifact that both sides read and edit in their own way.

- **The agent grills you first.** Before it writes a plan, it interviews you in rounds: every question it can ask without guessing at an answer it hasn't heard, each with its recommended answer, a picture where the answer turns on one, and a note of which earlier answers it builds on. You answer with **Yes**, a click on an alternative or your own words, and send the round from a bar at the bottom of the page with no verdict to pick. Answered questions fold to one line, so the board becomes a record of what was settled.
- **The agent** starts a board with `boundary new` and writes its `doc.json`: typed blocks such as questions, decisions, assumptions, steps, diagrams, mockups, screenshots and diffs. Each invocation gets its own board directory under the system temp directory, outside both the project and the skill.
- **You** see a page where you can pick options, mark assumptions right or wrong, drag, rename, strike or add plan steps, comment on any block, any passage of text, any box or arrow in a diagram, file or line, and drop pins on screenshots or mockup elements. When you can't choose yet, send the agent to **find out first** (it tries the options and comes back with measurements) or say **your call**. Mockups can carry controls, so you tune a design directly instead of picking between guesses.
- **The agent gets your feedback** as a digest from a blocking `wait` call, revises the board in place (the page updates live and marks what changed), and replies to each comment in its thread.

```
agent ── writes ──▶ doc.json ── watched ──▶  board server  ── SSE ──▶  browser
agent ◀── digest ── boundary wait ◀── long-poll ──┘   ▲
                                                     └── your feedback (POST)
                     feedback.json · history/N.json
```

## Install

Copy this folder into your skills directory, for example `~/.claude/skills/boundary-object`, or install the `bevan` plugin from this repository's marketplace. It needs Node 22.12 or newer.

The skill runs the CLI and board app from a [GitHub release](https://github.com/bevan-philip/skills/releases) with `npx`, so nothing in the skill's folder is built or installed. `SKILL.md` names the exact release. The first command downloads it (about 3 MB, prebuilt, no dependencies to fetch), and `--prefer-offline` keeps later commands from going back to the network.

To try it without an agent, from inside any git repository:

```sh
npx -y --prefer-offline https://github.com/bevan-philip/skills/releases/download/boundary-object-v0.1.0/boundary-object-0.1.0.tgz demo
```

This copies the three example boards (an interview, a plan and a report) into the board directory and opens the interview. To play the agent's side, run `wait session-store-interview` in another terminal and press **Send round 2** on the page.

## Layout

| Path | |
| --- | --- |
| `SKILL.md` | Instructions for the agent: when to use a board, the workflow, how to write a good one, how to act on feedback. |
| `references/blocks.md` | Every block type with a JSON example. |
| `app/bin/boundary.mjs` | Dependency-free CLI: `new`, `open`, `check`, `wait`, `feedback`, `list`, `stop`, `demo`, `version`. It is the `boundary` bin of the released package. |
| `app/examples/` | An interview in its second round, a plan that uses every block type, and a report with before/after screenshots. |
| `app/` | TanStack Start + React + Tailwind v4 + shadcn/ui. `components/ui/` holds stock components from the shadcn registry (Radix base, Nova style; see `components.json`), unmodified; the board's own colours are in `components/board/marks.tsx` and `styles.css`. |
| `app/src/lib/graph.ts`, `layout.ts` | Every box-and-arrow picture: `diagram` blocks, and Mermaid flowcharts and state diagrams parsed by [Pele](https://pele.run). Laid out by [ELK](https://eclipse.dev/elk/) (layered, orthogonal routing, inline edge labels, nested groups) from labels measured in the page font, then drawn with React Flow. Other Mermaid types (sequence diagrams, charts) are rendered by Pele itself. |
| `app/src/lib/schema.ts` | The board and feedback schemas (zod), shared by the page, the server and `check`. |
| `app/src/server/digest.ts` | Turns a round of feedback into the text the agent reads. |
| `app/ci/smoke.mjs` | Runs a packed tarball through `npx` and checks that it works; CI runs it before every release. |

## How it works

- **One server for all boards**, bound to 127.0.0.1 on port 4317 or the next free one. Boards live in `<temp dir>/boundary-object/<board-id>/` (override with `BOUNDARY_ROOT`). The server's details are recorded in `.server.json` there. The CLI restarts the server when it isn't the CLI's own version and build, as `/api/health` and `.server.json` report them, so a newer release or a rebuilt checkout takes over.
- **Each side owns one file.** The agent writes `doc.json`; the server writes `feedback.json` (an autosaved draft plus submitted rounds). Every content change to `doc.json` becomes `history/N.json`, which is how the page knows which blocks changed since your last round.
- **Long text lives in files.** Diffs, code and Mermaid source can sit in the board's `assets/` folder (`diffSrc`, `src`) instead of escaped JSON strings, so the agent writes `git diff > assets/x.diff` rather than retyping it. The server reads them in on every reload, so history snapshots hold the text and an edit to the file alone shows up as a change.
- **Guidance arrives with the feedback.** The digest ends with a *How to respond* section covering only the kinds of feedback in that round, so `SKILL.md` stays short.
- **Rounds.** Your edits collect in a draft until you press **Send**. While any question is open, that sends your answers as they are; once the agent has written the plan, you choose *approve*, *request changes* or *just comments*. `wait` returns the oldest round the agent hasn't received and marks it delivered, and the page shows that receipt. While a `wait` is open, the page shows the agent as listening.
- **Answers hold until the agent changes the question.** An answered decision shows as decided. If the agent later rewrites its question or options, the server works out from `history/` that the answer was given to something else, drops it, and the page asks again with the old answer as a history line. `check` makes the agent give a reason.
- **Plan edits are proposals.** Your strikes, renames, additions and reordering overlay the agent's steps until it revises the doc. After that the doc is the truth again, so the agent has to adopt each edit or explain why it didn't.
- **Only your browser can talk to it.** Requests must use a localhost Host header and must not be cross-site, and posts from other origins are refused. This matters because whatever reaches the server lands in the agent's context.

## Development

```sh
cd app
npm install
npm run dev        # vite dev server; set BOUNDARY_ROOT to a boards directory
npm run typecheck
npm run build      # what the CLI runs in a checkout
npm pack           # builds and packs boundary-object-<version>.tgz, as a release does
npm run smoke -- boundary-object-<version>.tgz
npx shadcn@latest add <component>   # add a stock shadcn component to components/ui
```

To have the agent use your checkout instead of the release, set `BOUNDARY_CLI` to the absolute path of `app/bin/boundary.mjs`. Run from a checkout, the CLI installs and builds the app on first use and rebuilds it whenever the sources change, and the board server restarts onto the new build.

## Releasing

A release is a GitHub release tagged `boundary-object-v<version>` whose asset is the packed tarball. The *boundary-object release* workflow makes it when a push to `main` changes `app/` and the version in `app/package.json` has no release yet: it packs the app, smoke-tests the tarball and publishes it. `SKILL.md` names the release's URL, so the skill and the app it runs change together.

To ship a change to the app, run `npm run bump -- patch` in `app/` (or `minor` for a new feature or a change to the `doc.json` format or the CLI) in the same pull request. It bumps the version and points `SKILL.md` and this README at the new release's URL. The *boundary-object check* workflow fails a pull request that changes the app without a newer version, or whose docs name another release (`npm run version-check -- origin/main` runs the same check locally). The release appears about a minute after the merge; until then the URL in `SKILL.md` on `main` is a 404.

## Limits and ideas

- The page is local-only. To review a board from another machine you need a port-forward.
- Feedback is batched into rounds; the agent sees nothing until you press Send. Streaming single comments to a listening agent would make it more conversational.
- The agent can't yet highlight a region of an image or point at part of a mockup in its own replies.
- Natural next blocks: a timeline, a metric before/after, and test results.
- The interview's design tree is implicit in each question's `after`. The page could draw it as a diagram: what's settled, what's open, and which branches a changed answer touches.
- Ideas from [Planning with agents](https://maggieappleton.com/planning-agents) not built yet: a shared board several people review together, with each decision recorded against who made it and when; a map of the files a plan touches; and live controls wired to the real app rather than a mockup.
