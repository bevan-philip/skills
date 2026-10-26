# Board format

`doc.json` is one JSON object. `boundary check` validates it against the schema in `app/src/lib/schema.ts`; the error paths it prints match the field names here. Two complete boards are in `examples/`: a plan (`session-store-plan`) that uses every block type, and a report (`session-store-report`).

## Top level

```json
{
  "title": "Move sessions out of process memory",
  "kind": "plan",
  "summary": "Two to four sentences of Markdown: what, why, and what you need from the human.",
  "status": "Plan ready. I haven't changed any code yet.",
  "blocks": [],
  "replies": {}
}
```

| Field | | |
| --- | --- | --- |
| `title` | required | Shown in the header and the hero. |
| `kind` | `"plan"` (default) or `"report"` | Changes the wording of the verdict buttons and the digest. |
| `summary` | Markdown | Large type at the top. The human can select text in it and comment. |
| `status` | one sentence | What you are doing now. Update it on every revision. |
| `blocks` | array | Rendered in order. |
| `replies` | `{ "<comment id>": { "text", "status"? } }` | Your answers to the human's comments. `status` is `resolved`, `declined`, `question` (you need something from them) or `noted`. `text` is Markdown. |

## Fields every block has

| Field | |
| --- | --- |
| `id` | Required and unique. Letters, digits, `-`, `_`, `.`. **Keep it stable across revisions.** |
| `type` | One of the types below. |
| `title` | Heading of the card. Defaults to the type's name. |
| `note` | One line of Markdown under the title, saying how to read the block. |
| `collapsed` | `true` starts the card folded. Use it for reference material. |
| `changeNote` | One line of Markdown on what you changed in this block and why, e.g. "Switched to a 14-day expiry, as you asked." It is shown only while the block differs from what the human last sent a round against, so an old note disappears by itself once the human has seen it. |

Every card has a **Comment** button, and the human can select any text inside a card to comment on that passage. Ids of items inside a block (steps, options, nodes, confirm items, table rows) must be unique within that block.

## Text

### `section`
A heading that groups the cards after it, and the outline's grouping.
```json
{ "id": "choices", "type": "section", "title": "Decisions I need from you", "body": "Optional intro." }
```

### `markdown`
```json
{ "id": "context", "type": "markdown", "title": "Where things stand", "body": "GitHub-flavoured **Markdown**, tables included." }
```

### `callout`
`tone` is `info`, `warning`, `risk` or `success`.
```json
{ "id": "risk", "type": "callout", "tone": "risk", "title": "Risk", "body": "Everyone is logged out once when this deploys." }
```

## Asking the human

### `decision`
One choice among options. Mark at most one option `recommended`. With `allowOther` (default `true`) the human can write in their own answer, and they can add a note to any choice.

Instead of picking, the human can answer **Find out first** (you try the options for real and ask again) or **Your call** (you decide). See "Acting on feedback" in SKILL.md.

| Field | |
| --- | --- |
| `reversible` | `true` shows "easy to change later", `false` shows "hard to undo". Set it so the human knows where their attention matters. |
| `options[].evidence` | Markdown: what you found by actually trying this option (a spike, a prototype, a benchmark), as opposed to what you predict. Shown as "What I found". |
| `options[].metrics` | `{ "name": value }`. Every metric across the options is shown in one comparison table under them. Use the same names on each option. |

```json
{
  "id": "storage", "type": "decision", "title": "Where sessions live",
  "question": "Which store should back sessions?",
  "context": "Roughly 4k active sessions, ~40 auth checks per second at peak.",
  "reversible": false,
  "options": [
    { "id": "postgres", "label": "Postgres table", "recommended": true,
      "summary": "A `sessions` table, swept hourly.",
      "pros": ["No new infrastructure"], "cons": ["One extra query per request"],
      "evidence": "Spiked on a scratch branch: the extra query adds 1.1 ms at p95.",
      "metrics": { "p95 added": "1.1 ms", "Files changed": 6 } },
    { "id": "redis", "label": "Redis", "pros": ["Fastest"], "cons": ["New service to run"],
      "metrics": { "p95 added": "0.4 ms", "Files changed": 9 } }
  ]
}
```

### `question`
An open question. `suggestions` become one-click answers.
```json
{ "id": "devices", "type": "question", "title": "Session list",
  "prompt": "Should users be able to sign out other devices?",
  "suggestions": ["Yes, in this change", "Yes, as a follow-up", "No"] }
```

### `confirm`
Statements the human marks **Right**, **Wrong** or **Not sure**, with an optional note. Use it for assumptions in a plan and for "please check" lists in a report.
```json
{ "id": "assumptions", "type": "confirm", "title": "What I'm assuming",
  "items": [
    { "id": "replicas", "text": "We run two API replicas with no sticky sessions." },
    { "id": "pg", "text": "Postgres 15 is in production.", "detail": "Found in `src/db.ts`." }
  ] }
```

## Plans and progress

### `steps`
Ordered work. When `editable` is true (the default), the human can drag to reorder, rename, remove (with a reason) or insert steps, and comment on each one. In a report, set `status` on each step to `todo`, `doing`, `done`, `skipped`, `changed` or `blocked`, and use `note` to explain any deviation; it is shown highlighted. Set `"editable": false` on report boards.
```json
{ "id": "plan", "type": "steps", "title": "Steps",
  "items": [
    { "id": "iface", "title": "Add a SessionStore interface", "files": ["src/sessions/store.ts"],
      "detail": "Markdown shown under a Details toggle." },
    { "id": "tests", "title": "Cross-replica integration test", "status": "done", "note": "Also covers logout." }
  ] }
```

### `table`
Rows are arrays of Markdown cells, or `{ "id", "cells", "highlight"? }` when you want stable row ids. Plain-array rows get the ids `row-1`, `row-2` and so on. The human can comment on a row.
```json
{ "id": "costs", "type": "table", "columns": ["Option", "Latency", "New infra"],
  "rows": [ { "id": "pg", "cells": ["Postgres", "~1 ms", "none"], "highlight": true }, ["Redis", "<0.5 ms", "yes"] ] }
```

## Pictures

### `diagram`
Boxes and arrows. The page lays them out with ELK: edges are routed around boxes, every label sits on its arrow, groups nest, and nothing is shrunk below a readable size (a wide diagram pans, and **Expand** opens it full screen). The human clicks any box or arrow to read its `detail` and comment on it.

| Field | |
| --- | --- |
| `direction` | `auto` (default) uses whichever of left-to-right and top-to-bottom fits the page better. `LR` or `TB` states a preference; the page still flips it when the other direction is much easier to read. |
| `nodes[].kind` | Picks an icon or shape: `service`, `ui`, `db`, `store`, `queue`, `external`, `actor` (pill), `file`, `function`, `note` (dashed), `decision` (diamond), `state` (rounded), `start` and `end` (dots, for state machines). |
| `nodes[].status`, `edges[].status` | `added`, `changed`, `removed` or `unchanged`. Use them to show the change; the page colours them and adds a legend. |
| `nodes[].group` | The id of a group to draw the node inside. |
| `groups[].parent` | Nest a group inside another. |
| `edges[].dashed` | Draws the arrow dashed (removed arrows are dashed anyway). |

Keep a diagram to about 15 nodes; split anything bigger into two diagrams that each answer one question. A comment on an arrow comes back as `arrow [from->to]`.
```json
{ "id": "architecture", "type": "diagram", "title": "Request path",
  "groups": [{ "id": "api", "label": "API process" }],
  "nodes": [
    { "id": "lb", "label": "Load balancer", "kind": "external" },
    { "id": "mw", "label": "auth middleware", "kind": "function", "group": "api", "status": "changed", "detail": "Markdown." },
    { "id": "db", "label": "Postgres", "kind": "db", "status": "added" }
  ],
  "edges": [ { "from": "lb", "to": "mw", "label": "cookie" }, { "from": "mw", "to": "db", "status": "added" } ] }
```

### `mermaid`
Any Mermaid diagram (Mermaid 12.1 syntax), parsed by [Pele](https://pele.run). `check` parses every diagram and rejects one with a syntax error, giving you the line and column.

- **Flowcharts and state diagrams** are drawn by the same layout engine as `diagram` blocks, so they get the same routing, sizing and click-to-comment boxes and arrows. Mark the change with classes named `added`, `changed` or `removed` (`A:::added`, or `class A added`); you don't need `classDef`. Write a flowchart in Mermaid when it's quicker than a `diagram` block; use a `diagram` when boxes need `detail` or icons.
- **Everything else** (sequence diagrams above all, but also ER, class, Gantt, timelines and charts) is drawn by Pele. The human comments by pointing: they click **Point**, then a spot on the diagram, and the digest gives you the label of what they clicked.

```json
{ "id": "login-flow", "type": "mermaid", "title": "Login", "code": "sequenceDiagram\n  Browser->>API: POST /login\n  API-->>Browser: Set-Cookie" }
```
```json
{ "id": "lifecycle", "type": "mermaid", "title": "A session's life",
  "code": "stateDiagram-v2\n  direction LR\n  [*] --> Active: login\n  Active --> Expired: 30 days idle\n  Active --> Revoked: sign out\n  Expired --> [*]\n  Revoked --> [*]\n  class Revoked added" }
```

### `image`
A screenshot or picture. `src` is a path relative to the board directory (`assets/after.png`) or a URL. Set `before` to another image to get a Before/After toggle. The human can drop numbered pins on the image; the digest gives each pin's position as a percentage, plus the absolute file path, so you can open the image and see what they pointed at.
```json
{ "id": "settings-shot", "type": "image", "title": "Settings page", "src": "assets/after.png", "before": "assets/before.png", "caption": "Markdown." }
```

### `mockup`
A sketch of a UI, rendered in a sandboxed iframe: either `html` inline (a fragment is fine, and gets a plain system-font base style) or `src` pointing at an HTML file in `assets/`. `height` is in pixels (default 420). In **Point** mode the human clicks a real element, and the digest gives you its tag, text and CSS selector. Keep it plain HTML and CSS with no network requests: the iframe has no access to anything outside itself.

**Controls** let the human tune a design directly instead of choosing between your guesses. Write the mockup's CSS against custom properties, and add a control for each one. The page sets the property on the mockup's root as the human moves the control, and the digest gives you the values they settle on.

| Control field | |
| --- | --- |
| `id`, `label` | Required. |
| `var` | The CSS custom property it sets, e.g. `--shadow-blur`. |
| `type` | `range` (default; needs `min` and `max`, optional `step` and `unit`), `select` (needs `options`) or `color`. |
| `value` | Your proposed value. A `range` value is a number; `unit` is appended to it. |

```json
{ "id": "card-mockup", "type": "mockup", "title": "Card shadow", "height": 240,
  "html": "<style>:root{--blur:8px;--lift:2px}.card{box-shadow:0 var(--lift) var(--blur) rgb(0 0 0/.2);padding:24px;border-radius:12px}</style><div class='card'>Card</div>",
  "controls": [
    { "id": "blur", "label": "Shadow softness", "var": "--blur", "min": 0, "max": 40, "unit": "px", "value": 8 },
    { "id": "lift", "label": "Lift", "var": "--lift", "min": 0, "max": 12, "unit": "px", "value": 2 }
  ] }
```

## Code

### `files`
A changed-files list for reports, or the files a plan touches. `change` is `added`, `modified`, `deleted` or `renamed` (use `from` for the old path). `diff` is unified diff text; the human can expand it and comment on any line, and the digest gives you the file, the line number and the line's text.
```json
{ "id": "changes", "type": "files", "title": "Files changed",
  "items": [ { "path": "src/middleware/auth.ts", "change": "modified", "summary": "Reads sessions from the store.",
               "diff": "@@ -10,3 +10,3 @@\n-  const s = sessions.get(id)\n+  const s = await store.get(id)\n   if (!s) return unauthorized()" } ] }
```

### `code`
A snippet the human should agree to: an interface, a schema, a config. Lines are numbered from `startLine` (default 1), `highlight` lists line numbers to tint, and the human can comment on any line.
```json
{ "id": "schema", "type": "code", "path": "migrations/0042_sessions.sql", "language": "sql", "highlight": [3],
  "code": "create table sessions (\n  id text primary key,\n  expires_at timestamptz not null\n);" }
```

## What comes back

`boundary wait` prints a digest like this. Ids in brackets are what you key `replies` on, or reuse when you adopt a step:

```
# Round 1 on board "session-store" — "Move sessions out of process memory"
The human reviewed revision 1.
Verdict: CHANGES REQUESTED. Do not start implementing. Revise doc.json to address everything below, then wait again.

## Decisions
- decision [storage] "Where sessions live" → option [postgres] "Postgres table" (your recommendation)
  note: "We already back up Postgres; no new infra please."
- decision [retry] "Retry API" → FIND OUT FIRST. Don't decide this yet: try the options for real, record what you found, and ask again.
  what they want to know: "How many of the 60 call sites does each one cover without hand edits?"

## Tuned values
- mockup [card-mockup] "Card shadow":
  - --blur ("Shadow softness") = "14px" (you proposed "8px")

## Confirmations
- confirm [assumptions] "What I'm assuming", item [logout-ok] "Logging everyone out once … is acceptable." → NO, wrong
  note: "Not OK: support gets flooded. Keep old sessions valid for a day."

## Plan edits
- in steps [plan] "Steps": REMOVE step [sliding] "Slide expiry forward…" — reason: "Premature; measure first"
- in steps [plan] "Steps": ADD step [fb-mvoj8x1] "Dual-read old sessions for 24h" after [tests] (reuse id "fb-mvoj8x1" if you adopt it)

## Comments
- [fb-mvoj8fgtawij] on diagram [architecture] "Request path", node [lb] "Load balancer":
  "Could we just turn on sticky sessions as a stopgap?"
- [fb-mvoj8ft9npbo] on mockup [devices-mockup] "Sessions section", element <button> "Sign out everywhere else" (selector: body > button.all):
  "This should be a destructive red button and ask to confirm."
```

Plan edits are proposals. After you revise `doc.json`, the page drops its overlay of the human's edits and shows your version, so apply the edits you accept and explain in a reply any you don't.
