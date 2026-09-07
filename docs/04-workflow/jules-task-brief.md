# Approved app task brief template

Copy this into a GitHub issue after the owner approves the app. Do not apply the `jules` label until approval is recorded. Never include secrets, private working files or personal data in an issue.

## Approval and context

- Owner approval and date:
- Brief version:
- App name and proposed route:
- User problem and expected outcome:
- Starting main commit (refresh before implementation):
- Read `AGENTS.md` and `docs/04-workflow/agent-collaboration.md` first.

## Scope

- Included features:
- Explicit exclusions:
- Input formats and limits:
- Output formats, quality and limits:
- Expected empty, loading, success, failure and cancellation behavior:
- Mobile and keyboard interaction requirements:
- Shared components/design references:
- Permitted dependencies and network operations (none unless explicitly listed):

## Acceptance criteria

List numbered, observable user outcomes, including export correctness and failure recovery. Separate required behavior from optional enhancements.

## Test and documentation plan

- Required static and browser cases:
- Output-content checks:
- Privacy/network checks:
- Mobile/keyboard checks:
- Architecture documents to update:
- Manual/physical-device checks to report separately:

Use existing bounded CI and package scripts. Generate documentation with `npm run build:docs` when rendered Markdown changes. Do not weaken gates, raise timeouts without evidence, or claim tests passed if they were unavailable.

## Delivery and review

Create a feature branch and PR targeting main. Include the issue/session links, summary, exact tested SHA, commands/results, CI URL, Cloudflare preview URL/commit and remaining limitations. Follow the correction-round protocol. Stop for material scope changes. Do not merge, push to main, or modify production/access settings. Final owner approval of the reviewed preview is required before Codex merges.
