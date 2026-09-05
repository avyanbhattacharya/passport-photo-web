# Project Continuity

## Goal

Clean Local Tools should not depend on the continued involvement of its founder or any other single maintainer.

A capable future maintainer with repository and infrastructure access should be able to understand the project, verify it, deploy it, recover it, and continue developing it using the repository and this handbook rather than private conversations or oral history.

This requirement includes future human maintainers and AI-assisted maintenance systems.

## Continuity test

The project is well documented when a new maintainer can answer these questions without contacting the previous maintainer:

- What is the project's mission and what must not be compromised?
- Where is production hosted?
- What domain serves production and how is DNS conceptually configured?
- What code reaches production?
- How are changes tested?
- What constitutes a successful release?
- How is a new tool added?
- Which privacy guarantees are architectural requirements?
- Which dependencies come from third parties?
- Which features require network access on first use?
- How does local AI choose WebGPU or fallback execution?
- What are the known limitations and risks?
- How can the site be restored if hosting changes or an account becomes unavailable?

If an answer exists only in someone's memory, an old chat, or an untracked local file, it should be migrated into this handbook.

## Current operational shape

At the time this document was introduced:

- Source repository: `avyanbhattacharya/passport-photo-web`
- Production domain: `cleanlocaltools.com`
- Hosting: GitHub Pages from the repository's `main` branch and repository root
- DNS provider/registrar: Cloudflare
- Application style: static HTML/CSS/JavaScript with browser-local processing
- CI: GitHub Actions quality gates
- Historical known-green baseline branch: `baseline/clean-local-tools-ci-v1`

These are operational facts, not eternal architectural requirements. If they change, update this document and the relevant operations documentation in the same change.

## The baseline branch

`baseline/clean-local-tools-ci-v1` is a permanent reference to a known-green Clean Local Tools and CI foundation. It exists as a recovery/reference template.

Do not force-push, delete, or move this branch as part of normal development. Redefining the historical baseline requires an explicit project decision.

## What must be portable

The following should remain recoverable from version-controlled source wherever possible:

- application source;
- tests and test fixtures;
- CI configuration;
- documentation;
- sitemap and search metadata;
- service-worker/PWA configuration;
- local AI runtime interfaces and model/dependency manifests;
- architecture decisions;
- deployment instructions;
- dependency upgrade instructions;
- a description of DNS records and external services needed for recovery.

Secrets, credentials, account recovery codes, and private personal information must **not** be committed to the repository. Documentation should describe where access is required without exposing credentials.

## Minimize external dependencies

Long-term survival improves when the application needs fewer paid services, servers, databases, API keys, and proprietary infrastructure components.

This is one reason static hosting and browser-local processing are architectural strengths rather than merely implementation conveniences.

Third-party libraries and models are still dependencies. Over time, important runtime assets should be evaluated for self-hosting and offline caching where licensing, size, security, and maintenance make that sensible.

## Domain and hosting continuity

The custom domain is a human-facing asset independent of any particular hosting provider. If GitHub Pages becomes unsuitable, a future maintainer should be able to deploy the static repository to another static host and point DNS to the replacement.

Do not design core tools around GitHub-specific runtime APIs. GitHub is currently a host and collaboration platform, not part of the user's document-processing path.

## Documentation continuity

The canonical handbook lives in `/docs` inside the repository rather than exclusively in a vendor-specific wiki. This keeps documentation versioned with the code and makes it portable to another Git host or documentation renderer.

A future public documentation site or GitHub Wiki may render or link to these files, but should not become the only source of architectural knowledge.

## Maintainer handoff checklist

Before a planned ownership handoff, verify at minimum:

1. Repository ownership/admin access can be transferred or shared appropriately.
2. Domain registrar and DNS administrative access can be transferred according to the provider's supported process.
3. GitHub Pages/custom-domain configuration is documented and reproducible.
4. Search Console or equivalent webmaster access can be transferred where appropriate.
5. CI passes from a clean checkout.
6. No production build depends on an untracked file on a maintainer's machine.
7. Important third-party dependencies and licenses are documented.
8. Known risks and unfinished migrations are documented.
9. The new maintainer can make a trivial tested change and deploy it using only documented procedures.

## Disaster recovery principle

The repository should be sufficient to reconstruct the application on a new static host. The domain should be redirectable to that host through DNS. User files should not require recovery because Clean Local Tools does not maintain a server-side store of users' working documents.

Future features must be evaluated against this property before introducing persistent server-side state.
