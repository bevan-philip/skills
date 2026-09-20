---
name: make-plan
disable-model-invocation: true
description: Turn anything in the current context into a structured, agent-executable plan document saved to docs/. Use when asked to create or write a plan.
---

# Make Plan Skill

Convert whatever is in the current context into a structured, agent-executable plan document and save it to `docs/` in the project root.

## Template

The template is at `~/.claude/skills/make-plan/template.md`. Read it before writing. Use it as the structure — fill in the placeholders, add or remove phases as needed.

## Rules

**Purpose section** — rationale lives here and only here. Write it as a bullet list of plain sentences, maximum 10 bullets. Each bullet states one fact about what the plan does, why, or what problem it solves. Do not repeat the "why" anywhere else in the document.

**No backward compatibility** — plans produced by this skill favor the cleanest end state. Do not add backward-compatibility shims, re-exports, or deprecation wrappers unless the plan explicitly requires them. When old and new things conflict, remove the old thing.

**No working-state requirement between phases** — the application is not expected to compile or run correctly at the end of every phase. It only needs to work at the very end. Do not add transitional glue code to keep things working mid-plan.

**Agent Instructions** — copy the block from the template verbatim. Adjust only the first bullet if the nature of the work means intermediate breakage is impossible (e.g. a docs-only plan — drop that bullet).

**Checklist items** — each item is a single, concrete, completable action written as an imperative sentence with no explanation appended:
- Right: `Remove \`get_contacted_listings\` from \`src/services/listing_service.rs\`.`
- Wrong: `Remove \`get_contacted_listings\` (it is never called from any handler).`
- One action per item. Split compound actions into sequential items.
- Include the file path when there is a single obvious location.
- No sub-bullets.

**Phases** — group items so each phase is independently executable. Common ordering:
- Removal before addition.
- Schema / data model before logic that depends on it.
- Core logic → integration → verification.
- Verification and cleanup always last.

**Final Completion Criteria** — short list of observable facts that together prove the work is done. These are checkboxes too.

## Output

1. Choose a short descriptive filename: `docs/<topic>-plan.md`.
2. Check whether a plan file for this topic already exists. If it does, ask the user whether to overwrite or extend it.
3. Write the file using the Write tool.
4. Tell the user the file path and give a one-line summary of what was captured.
