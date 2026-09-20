# {Plan Title}

## Purpose

- {What this plan accomplishes.}
- {Why it is needed, or what problem it solves.}
- {Any additional context — constraints, scope boundaries, decisions already made. Maximum 10 bullets total.}

This plan is written for another agent, not for a human operator.

## Agent Instructions

- This plan does not need to preserve a working application after each phase. The application only needs to work at the very end.
- Do not spend time on backward-compatibility shims.
- As each checklist item is completed, update this file in the same change set by replacing `[ ]` with `[x]`.
- Do not mark an item as checked until the code and tests for that item are actually complete.
- If new work is discovered, add new unchecked checklist items to the appropriate phase instead of silently folding the work into an existing item.
- Do not delete completed checklist items. Keep the execution record intact.
- At the end of the plan, every completed item should be marked `[x]`, and any intentionally deferred work should remain `[ ]` with a short note added nearby.

## Phase 1: {Phase Name}

- [ ] {Imperative action. Single concrete step. File path when relevant.}
- [ ] {Imperative action.}

## Phase 2: {Phase Name}

- [ ] {Imperative action.}
- [ ] {Imperative action.}

## Phase N: Verification And Cleanup

- [ ] {Run formatter.}
- [ ] {Run tests.}
- [ ] {Run linter.}
- [ ] Re-open this plan and mark every completed item as `[x]` before handing off the work.

## Final Completion Criteria

The work is complete only when all of the following are true:

- [ ] {Observable fact that proves the work is done.}
- [ ] {Observable fact.}
- [ ] The full test suite passes.
- [ ] This document has been updated so every completed item is checked.
