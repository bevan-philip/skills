# Board format

`doc.json` is one JSON object. `boundary check` validates it against the schema in `app/src/lib/schema.ts`; the error paths it prints match the field names here. You don't need more than this page to write a board. If you want a complete one to copy from, `examples/` has a plan that uses every block type and a report.

**Long text goes in files.** Paths are relative to the board directory, and the files must sit in its `assets/` folder, which the page watches for edits:

| Field | Instead of | Example |
| --- | --- | --- |
| `diffSrc` on a `files` item | `diff` | `git diff -- src/auth.ts > assets/auth.diff` |
| `src` on a `code` block | `code` | `sed -n '10,40p' src/store.ts > assets/store.ts` |
| `src` on a `mermaid` block | `code` | a `.mmd` file |
| `src` on a `mockup` block | `html` | an `.html` file |

Give one or the other, not both. The page updates when you edit the file, and `check` validates its contents as if it were inline.

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
| `id` | Required and unique. Letters, digits, `-`, `_`, `.`, and not a built-in object property name such as `constructor` or `toString`. **Keep it stable across revisions.** |
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

Instead of picking, the human can answer **Find out first** (you try the options and ask again) or **Your call** (you decide); the digest says how to handle each. For which edits reopen an answered decision, see "Acting on feedback" in SKILL.md.

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
Any Mermaid diagram (Mermaid 12.1 syntax) in `code`, or in a file named by `src`, parsed by [Pele](https://pele.run). `check` parses every diagram and rejects one with a syntax error, giving you the line and column.

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
A changed-files list for reports, or the files a plan touches. `change` is `added`, `modified`, `deleted` or `renamed` (use `from` for the old path). `diffSrc` names a unified diff file for that one path (`git diff` output, headers and all), or give the text inline as `diff`. The human can expand it and comment on any line, and the digest gives you the file, the line number and the line's text.
```json
{ "id": "changes", "type": "files", "title": "Files changed",
  "items": [ { "path": "src/middleware/auth.ts", "change": "modified", "summary": "Reads sessions from the store.",
               "diffSrc": "assets/auth.diff" },
             { "path": "src/sessions/memory.ts", "change": "deleted", "summary": "Replaced by the store." } ] }
```

### `code`
A snippet the human should agree to: an interface, a schema, a config. Put it in `code`, or for more than a few lines, in a file named by `src`. Lines are numbered from `startLine` (default 1), `highlight` lists line numbers to tint, and the human can comment on any line.
```json
{ "id": "schema", "type": "code", "path": "migrations/0042_sessions.sql", "language": "sql", "highlight": [3],
  "code": "create table sessions (\n  id text primary key,\n  expires_at timestamptz not null\n);" }
```

A `code` block is also the place for shapes that are easier to read as text than as boxes: pseudocode, a call tree, a component tree (with the file each component lives in), or a shallow file tree with a `# comment` per entry. Indent by depth and leave out everything the question doesn't turn on.

With `"language": "diff"`, lines starting with `+` and `-` are shown as added and removed. Without `@@` hunk headers the block is a sketch of a change to such a shape, not a patch: start every unchanged line with a space, as in a real diff, so the indentation lines up. Every line, removed ones included, is numbered from `startLine`, and a comment comes back with that number. With hunk headers, it renders as a unified diff and is numbered like one (but a diff of a real file belongs on a `files` item as `diffSrc`).
```json
{ "id": "call-path", "type": "code", "title": "What an authenticated request calls", "language": "diff",
  "code": " handleRequest\n   authMiddleware\n-    sessions.get(id)\n+    await store.get(id)\n     attachUser" }
```

## What comes back

`boundary wait` prints a digest: one section per kind of feedback (Decisions, Tuned values, Answers, Confirmations, Plan edits, Comments), each line naming the block and item by id in brackets with its label, and the human's words quoted. Key `replies` on the comment ids it gives, and reuse the id it gives for any step the human added. It ends with **How to respond**, which tells you how to handle each kind of item in that round.
