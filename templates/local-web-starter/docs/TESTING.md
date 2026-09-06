# Testing without endless pipelines

## Layers

Node tests cover configuration, parsing, validation, limits and build/export invariants without browser downloads. Playwright checks real UI interactions and downloaded bytes. Chromium is the deep default; WebKit and iPhone emulation cover high-risk compatibility paths. The tiny starter runs both sample tests in all three engines; as tools grow, narrow compatibility to representative workflows rather than duplicating everything.

Pin the Playwright package AND browser-cache version together. Commit the npm lockfile and use npm ci. Install browser OS dependencies even on a browser-cache hit. Cache browser binaries, not assumptions about the runner.

## Budgets

Starter CI: static job 3 minutes, browser job 8 minutes. Test timeout 30 seconds, expectation timeout 5 seconds, browser global ceiling 4 minutes in CI, 2 workers, 1 retry. Trace only first retry; screenshots on failure; reports uploaded on failure. New commits cancel obsolete runs. Split future large suites into named tool-family steps/jobs while preserving bounds.

Do not add waitForTimeout, arbitrary sleeps, unbounded initialization, continue-on-error, or test skipping as repairs. Wait for a state or poll a meaningful property. Failed browser downloads are environment failures, not passing tests.

## Feature minimum

Happy path; actual output/content; invalid/empty/oversized input; cancellation and stale completion; responsive overflow; keyboard/touch; resource cleanup; meaningful privacy/network assertions. Use deterministic fixtures. Mock external responses for URL failure/CORS cases; separately label live manual evidence.

WebKit emulation is not every physical iPhone or GPU. Print invocation can be stubbed, but native dialogs and physical print output need manual acceptance. Source-string assertions supplement rather than replace behavioral tests.

## Release report

Record commit SHA, workflow URL, each job result, skipped or blocked checks, manual evidence and remaining risks. A previous green run is not evidence for a later commit. Do not merge a draft just because a preview renders.
