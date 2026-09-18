# Local-first Web Starter

A standalone, exportable project distilled from Clean Local Tools. No framework, server inference, account, analytics or cloud storage is required for the sample app. This is a source-code template for humans and any AI agent, not an installed ChatGPT skill.

## Start here

1. Read AGENTS.md, docs/ARCHITECTURE.md and docs/LESSONS.md.
2. Export this directory into a NEW absolute destination:
   node scripts/export.cjs /absolute/path/my-new-project
   When running from the parent Clean Local Tools repository:
   node templates/local-web-starter/scripts/export.cjs /absolute/path/my-new-project
3. In the exported directory: npm ci
4. npm run test:static
5. npm run build
6. npx playwright install --with-deps chromium webkit
7. npm run test:browser
8. npm start; visit http://127.0.0.1:4173

Use Node 24. Change site.config.json name and origin; retain main as productionBranch unless deliberately changing it in BOTH code and Cloudflare. The placeholder example.invalid intentionally blocks production builds.

## Make it your project

Initialize a NEW git repository in the exported directory, commit its files (including package-lock.json and .github), and push to a new repository you control. The exporter never reuses the original .git history, credentials, node_modules, build outputs or runtime artifacts. Do not publish this parent repository as your new product.

The working example trims text and downloads the actual result locally. Replace it with one useful workflow and extend the tests. The CSS is intentionally small and independent of the original product's identity. HTML, CSS and browser JS are the runtime; Node is for development, tests and compilation only.

Read docs/CLOUDFLARE.md for production and all-branch previews. Publish only dist, never repository root. No Cloudflare account, project or custom domain has been created by exporting this starter.

## What is saved

Architecture and trust boundaries; fast/static/deep/compatibility test strategy; CI budgets and diagnostic habits; Cloudflare setup and troubleshooting; branch/PR/release rules; Markdown-to-HTML ownership; SEO/privacy/offline requirements; optional WebGPU/WASM architecture; exact project lessons and an evidence/status ledger; feature and session-handoff templates.

## Verification boundary

The source project passed run 240 for HTML Printer on 2026-09-05. That result does not certify this new starter. Consult the parent PR's Starter verification workflow and docs/STATUS.md for this template's own evidence. Real print dialogs, physical GPUs, and your new Cloudflare configuration require separate checks.
