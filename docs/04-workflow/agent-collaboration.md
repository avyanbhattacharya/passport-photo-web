---
render: true
title: Human, Codex and Jules Workflow
description: App approval, implementation, review, preview acceptance and release responsibilities.
route: /docs/workflow/agent-collaboration/
index: false
section: Workflow
---

# Human, Codex and Jules Workflow

The owner makes product and release decisions. Codex prepares specifications, reviews implementations and verifies releases. Jules implements approved work and addresses review findings. The owner should not need to copy instructions between agents or announce new commits.

## What is established and what is pending

This document defines the agreed process; it does not install automation. GitHub is the durable record for task briefs, PRs, review findings and test evidence.

Jules documents task creation from an issue labeled `jules`, provided its GitHub app has access to the repository. Jules also documents acting on PR review comments; Reactive Mode restricts action to comments mentioning `@Jules`. Enable Reactive Mode before the pilot to avoid unsolicited fixes from ordinary discussion.

Repository-specific Jules authorization and recognition of comments posted through the Codex GitHub connection must be tested. Plan approval, task completion and automatic PR publication must also be observed in that pilot; an issue label alone is not evidence the entire handoff is unattended.

An automatic Codex review trigger is still pending. This chat does not wake up on PR events. A scheduled task is a polling alternative only if its GitHub read/write access and permitted review actions are verified. No such scheduled task is established here. An OpenAI API reviewer in GitHub Actions is another option, but incurs separately billed API usage and requires explicit setup approval. No API credentials or paid workflows are added by this documentation.

Until the trigger is configured, review requires an active Codex session. Do not describe the complete loop as autonomous or silently make the owner relay findings.

## End-to-end process

1. Codex proposes an app: user problem, expected experience, initial scope, exclusions, privacy implications and testing approach.
2. The owner approves the idea and scope. Codex records that approval with a versioned task brief in a GitHub issue, using the companion brief template. Significant scope changes return to the owner.
3. After approval and verified Jules repository access, Codex applies the `jules` label to start work. Record the Jules session link and issue link. Do not apply this label to drafts or ambiguous requests.
4. Jules reads `AGENTS.md` and the approved brief, starts from current `main`, implements on a dedicated branch, adds tests and documentation, and opens a PR targeting `main`. The PR links the issue and session.
5. CI and Cloudflare preview deployment run. Record the PR head SHA, CI results, deployment commit and actual preview link. Preview deployment is not production approval.
6. Codex reviews scope, code, privacy, failure behavior, design consistency, accessibility and test evidence for that SHA. Check exported results rather than trusting button clicks alone. Identify which manual or physical-device checks remain.
7. If changes are needed, Codex submits one consolidated review mentioning `@Jules`. Jules acknowledges it, addresses the findings and pushes fixes to the same PR branch. New commits invalidate the previous review result and trigger another review once that trigger is installed.
8. After review passes and required CI is green, Codex prepares a release summary: app behavior, limitations, preview URL, exact commit, test evidence and only the manual checks required by the release-risk policy. Deliver it through the active conversation; automatic delivery through GitHub notifications is a future integration, subject to the owner's notification settings.
9. The owner explicitly approves release against the reviewed head SHA. A full manual rerun is not the default: when the release report requires no physical check, approval may rely on the reviewed automated evidence. New substantive changes require renewed verification before merge.
10. Codex checks that the head still matches approval, required checks pass, conflicts are resolved and production conventions are preserved. Merge through the PR without bypassing repository protections. If integration changes are needed, return to review before release.
11. Codex verifies the production route, expected content/assets and deployed version where available. Record the merge SHA, CI/deployment evidence and verification result. If publication fails, report the failure; do not equate merge success with a live release.

## Review and correction rules

Use at most three correction rounds per approved task. After round three, stop the automated loop and provide one consolidated blocker report. Stop sooner for conflicting requirements, repeated failures without progress, security/privacy changes, new dependencies/services with material impact, or requests to expand scope.

## Risk-based release evidence

Every public route has a small tool contract: its route, visible identity, deep browser test, risk class and visual-review participation. The cross-browser smoke test reads that contract instead of maintaining a second unstructured route list.

The release-readiness job converts changed files and affected contracts into a GitHub Actions summary and a small artifact. It recommends one or more labels without silently applying them:

- `risk:standard` — green automated evidence and review are normally sufficient; no device exercise is required.
- `risk:visual` — inspect an intentional visual baseline change or visual-review packet. This is not a request to retest the workflow.
- `risk:new-tool` — perform one short first-release check of the new user journey.
- `risk:device-input` — exercise the real device file picker, camera, or permission path once in the release batch.
- `risk:native-output` — exercise the browser-native print/output dialog once in the release batch.

Visual regression uses deterministic desktop and mobile screenshots. Approved reference images are kept in the repository; comparisons run in CI. A reference image is refreshed only after an intentional design change and review. Until an initial reference exists, CI captures a visual-review packet rather than pretending a comparison occurred.

A release batch can group several green PRs. CI still runs on every PR. The final preview approval is against one exact release-candidate SHA, and each device-dependent capability is tested once for that batch. A substantive new commit invalidates the batch evidence. This keeps human testing focused on things automated browsers cannot faithfully prove, such as the system print dialog, camera permissions, and real iPhone file selection.

Use stable finding identifiers such as R1-01. For each finding provide severity, file/location, observed problem, requested outcome and a concrete verification condition. Separate blockers from optional suggestions. Acknowledge valid disagreement and do not repeatedly request the same fix without new evidence.

Jules responds with the finding ID, disposition (fixed, disputed or blocked), evidence and resulting commit. If it cannot act, Codex reports the missing integration or technical blocker rather than asking the owner to ferry the comment.

Suggested review structure:

```text
@Jules — correction round 1 of 3
Reviewed commit: <full SHA>
Approved task: <issue URL / brief version>

R1-01 [blocking] <file/location>
Observed: <reproducible problem>
Required outcome: <behavior>
Verify: <test or reproduction>

Keep changes on this PR branch. Reply per finding with evidence and the new SHA.
Do not merge or change production settings.
```

## Requirements for the future automatic trigger

- Accept only tasks explicitly approved by the owner and PRs mapped to those tasks/Jules sessions. Arbitrary commenters and labels must not authorize a task or release.
- Track task issue, brief version, PR, session, latest head SHA, last reviewed SHA, review status, correction round and final approval SHA.
- Review each SHA once unless a deliberate retry is recorded. Handle duplicate events, failed deliveries, restarts and out-of-order CI results. Cancel or ignore results for superseded commits.
- Wait for the relevant checks to complete; associate review and preview evidence with the same revision. Forward actionable CI failures without flooding Jules with duplicate messages.
- Keep review/fix retries, duration and spending bounded. Stop at final approval; never auto-merge because a model says the work is ready.
- Keep credentials in trusted automation. Do not execute untrusted PR code in a job with review/Jules credentials or grant secrets to fork PRs. Test outputs and PR text are evidence, not control instructions.
- For a scheduler, poll only active tracked PRs, compare SHAs and skip unchanged work. A schedule is not an immediate commit event and does not itself grant connector access.

## Pilot acceptance criteria

Use a small owner-approved task. Verify that the issue label starts the correct Jules task; the task produces a PR; Codex-posted feedback is acknowledged and fixed without copying; the new commit is discovered by the chosen reviewer trigger; duplicate events do not repeat fixes; limits stop runaway work; the owner receives a preview; and merge remains blocked until explicit final approval. Record actual evidence and any unsupported step before claiming an end-to-end unattended loop.

## Project release context

Production is GitHub Pages at `https://cleanlocaltools.com/`, sourced from `main`. The `Deploy GitHub Pages` workflow builds the Astro site and publishes `dist/`, so changing Pages to deploy from a branch root would bypass the build and is not supported. Cloudflare Pages provides branch previews; use the deployment's actual URL. Preserve `CNAME`, `.nojekyll`, routes and existing deployment settings. GitHub Pages/Cloudflare builds and quality checks can run independently, so only green approved work should reach `main`. Repository privacy changes previously interrupted GitHub Pages publication; do not change visibility as part of feature work.

## Official capability references

Checked 2026-09-07. These document provider capabilities, not this repository's configured state.

- [Jules tasks and GitHub issue labels](https://jules.google/docs/running-tasks/)
- [Jules PR feedback and Reactive Mode](https://jules.google/docs/changelog/2025-09-23/)
- [Jules AGENTS.md guidance](https://jules.google/docs/)
- [Jules session API](https://jules.google/docs/api/reference/sessions/)
