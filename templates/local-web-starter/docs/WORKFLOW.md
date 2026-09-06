# Branches, releases and continuity

main is releasable production. feature/* and fix/* are short-lived work branches; test/* holds experiments. Create a pull request, run bounded checks, publish a preview, review the UX/output and merge only after required checks. Configure repository branch protection; a YAML file alone does not protect main.

Long-lived experiment branches need deliberate main merges and branch-specific regression checks. Preserve their architecture status and history. Keep a known-green baseline tag/branch immutable. Never force-push to make histories look synchronized. Do not promise ongoing branch maintenance unless a scheduled task or CI mechanism actually exists.

## Session handoff

Update docs/STATUS.md at each milestone with source commit, current branch, intent, edits, exact commands and results, CI URL, preview URL/commit, manual evidence, known blockers and next action. Label proposed versus verified. Do not make a chat conversation the only place decisions live.

## New feature checklist

Useful regular-user task; local-first justification; inputs/limits; deterministic happy path; malformed input; cancellation/stale state; output inspection; keyboard/mobile; network policy; dependencies and licenses; tests in CI; architecture/ADR changes; catalog/canonical/sitemap; preview review; manual device requirements; rollback plan.

## ADR template

Title/date; status (proposed/accepted/superseded); problem; options; chosen approach and why; consequences; privacy/security boundaries; automated evidence; manual evidence; rollback/revisit trigger. Store meaningful decisions in a new Markdown document under docs.
