# Cloudflare Pages production and previews

## One-time setup for a new exported repository

In Workers & Pages, create a Pages project and connect the new GitHub repository. Use framework preset None, repository root as root directory, build command npm run build, output directory dist, production branch main. Set NODE_VERSION to 24 for production and preview environments or use the included .nvmrc. Set site.config.json to the real HTTPS origin before the first production build.

In Settings / Builds & deployments / branch controls, choose All non-Production branches for previews and save. Leave production branch and production auto-deployment policy unchanged unless explicitly deciding to change them. Subsequent non-production pushes should build independent previews. Already-existing commits may need a fresh deployment; do not move production to preview an app.

This starter checks CF_PAGES_BRANCH against site.config.json productionBranch. Non-production and local builds emit noindex headers, disallow robots and omit public sitemap URLs. Technical docs are noindex in either environment. Search controls are not access controls: previews are public unless Cloudflare Access is configured.

Copy the actual deployment/branch-alias URL from Deployments; do not invent the alias or guess the project name. Branch aliases track newer successful deployments while commit-specific deployment links identify a version. Test the new tool's route, not only root. Verify commit SHA, successful build, assets, headers and console.

## Production release gate

GitHub Actions and Pages builds run independently. Pages Git integration does not automatically wait for GitHub quality checks. Protect main with required checks and merge only green reviewed commits. Do not push directly to main if CI-before-production is required. Roll back using a known-good deployment or a reviewed revert; keep the original baseline immutable.

## Important distinction

The historical Clean Local Tools product was documented as GitHub Pages production with Cloudflare used for hardware previews. Its exact current Cloudflare dashboard settings, production branch, project name and custom-domain bindings have NOT been inspected by this template. The user requested all non-production previews; that is not evidence it was enabled. This document provides a NEW project's desired setup, not a claim to have changed the existing account.

Do not copy the hardware branch's root redirect to /labs/local-ai/ into this starter: it would hide the new homepage. Do not assume Pages and Workers branch controls or CLI commands are interchangeable.

## Troubleshooting

No build: verify Git integration access, Pages versus Workers, branch controls, build-watch paths and a new commit/deployment. Wrong page: verify branch/commit, output folder, root redirect and route. Stale page: inspect cache headers and service worker scope; do not tell users to clear everything before checking version identity. Failed build: read logs for Node version, command and output path. Browser download blocked locally: run CI, report limitation, never claim local browser success.

## Official references checked 2026-09-06

https://developers.cloudflare.com/pages/configuration/branch-build-controls/
https://developers.cloudflare.com/pages/configuration/preview-deployments/
https://developers.cloudflare.com/pages/configuration/build-configuration/
https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
https://developers.cloudflare.com/pages/configuration/build-image/

Dashboard labels can change. Cloudflare currently recommends Workers for new general-purpose projects; this template deliberately retains the user's requested static Pages workflow. Reevaluate for server functionality instead of migrating silently.
