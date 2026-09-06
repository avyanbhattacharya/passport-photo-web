# Starter status and future handoff

Created 2026-09-06 from the Clean Local Tools engineering lessons.

## Scope

New standalone static starter, with sample app, Node tests, three-engine Playwright tests, docs build, bounded CI, export command and Cloudflare guide. It is stored under templates/local-web-starter in the source repository so it is durable and reviewable. It is not yet a separate GitHub repository marked “Template repository”; exporting and creating that repository is an explicit setup step.

## Verified versus pending

Source project's HTML Printer checks passed run 240, as linked in LESSONS.md. This is provenance only. New starter's own checks must be recorded in its parent PR. No new Cloudflare project/domain was provisioned, no credentials were copied, and no dashboard setting was verified.

Starter implementation commit 26ad839dc8b62a415677c80b4dba33e70f9b8b90 passed its own static and browser jobs on 2026-09-06:
https://github.com/avyanbhattacharya/passport-photo-web/actions/runs/34004821805
The parent product's regression workflow also passed:
https://github.com/avyanbhattacharya/passport-photo-web/actions/runs/34004821734
Local checks passed: 3 Node tests, docs/static build, export into a new directory and production-placeholder rejection. Browser workflow covers the sample app in Chromium, WebKit and mobile WebKit. This evidence describes that implementation commit; new feature changes require new evidence. PR #3 holds the latest check status.

HTML Printer live URL change is isolated in PR #2 (not bundled as starter runtime): commit 92c1e3c374cdf099431ce4af8b50febc30f80964 passed source run 241, including its URL failure/cancellation tests:
https://github.com/avyanbhattacharya/passport-photo-web/actions/runs/34004512600

## Fill after adopting

Repository:
Branch and commit:
Product goal:
Canonical origin:
Production host/branch:
Preview policy and verified deployment URL/commit:
Static/build/browser results and CI URL:
Physical-device/manual results:
Open risks and next action:
Last updated:

Never replace an unknown with an assumed success.
