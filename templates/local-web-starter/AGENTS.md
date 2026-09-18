# Instructions for every human or AI maintainer

Read README.md, docs/ARCHITECTURE.md, docs/TESTING.md, docs/CLOUDFLARE.md, docs/LESSONS.md and docs/STATUS.md before changes. These files are the continuity contract; do not assume chat history.

- Preserve unrelated edits. Inspect git status and branch before modifying. No force push, history rewrite, baseline movement, production deployment or secret/account changes without explicit scope.
- Build one useful user workflow at a time. Default to semantic HTML, CSS and plain JavaScript. New dependencies or services need a reason and recorded tradeoffs.
- Never upload working files or introduce telemetry/proxies silently. State all intentional network contact before it happens. Never put credentials in frontend code.
- Untrusted HTML is not safe because it is in an iframe. Reconstruct an allowlist, block active content/resources, layer CSP, and test malicious inputs and network behavior.
- Bound file size, complexity, work duration, history and retries. Handle cancellation, stale completions and empty output.
- Add regression tests with every meaningful change. Keep CI bounded; never hide failures, add fixed sleeps or disable coverage to obtain green.
- Run static tests, build, Chromium and targeted WebKit/mobile checks. Inspect the actual CI results for the commit. Report blocked checks separately.
- Verify generated docs. Edit Markdown sources, not generated HTML. Never deploy tests, docs source, secrets or build tooling as public assets.
- Preview branches are not releases. Production uses main; protect merges with required checks. Preview deployment success is not evidence that GitHub tests passed.
- Never claim offline support, GPU acceleration, universal browser compatibility or a live deployment based on API detection or code inspection alone.
- Update docs/STATUS.md after each meaningful session: branch/commit, tests run, failures, next action, deployment evidence and unresolved choices.
- Keep a user's machine report technical and manual-only. Do not store working files, URLs, image contents, secrets or unrelated personal history.
