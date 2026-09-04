# Clean Local Tools Handbook

This directory is the durable human-and-AI-readable handbook for Clean Local Tools.

If you are a future maintainer, contributor, automated coding agent, or AI assistant with no prior project context, **start here**. Do not assume undocumented knowledge from previous conversations.

## What this project is

Clean Local Tools is a collection of useful browser-based tools designed around a simple idea: people should be able to perform everyday digital tasks without unnecessarily surrendering their files, personal information, or attention.

**Master promise:** **Your files never leave your machine.**

The intended product direction is private, local-first software that runs primarily in the user's browser. The project deliberately avoids a business model based on harvesting user data or filling utilities with advertising.

## Reading order

1. [Mission and Vision](01-purpose/mission-and-vision.md)
2. [Principles](01-purpose/principles.md)
3. [Project Continuity](01-purpose/project-continuity.md)
4. [Architecture Overview](03-architecture/architecture-overview.md)
5. [High-Level Design](03-architecture/hld.md)
6. [Low-Level Design](03-architecture/lld.md)
7. [Testing Architecture and Strategy](04-testing/testing-architecture-and-strategy.md)
8. [Test Results](04-testing/test-results.md)
9. [Adding a New Tool](05-development/adding-a-new-tool.md)

## Documentation rules

These documents are part of the system, not promotional copy.

- Write for a capable person who has never seen the repository before.
- Also write so an AI coding agent can recover intent, constraints, architecture, and verification steps without relying on chat history.
- Explain **why** important decisions exist, not only what the code currently does.
- Clearly distinguish current behavior, architectural direction, and future ideas.
- Never claim a privacy, offline, security, browser-compatibility, or test guarantee that the implementation does not actually prove.
- Keep commands, paths, routes, interfaces, and invariants explicit.
- Update documentation in the same change when architecture or operating assumptions change.
- Record significant architectural choices as Architecture Decision Records (ADRs).
- Prefer plain language first. Add technical detail where it helps a maintainer reproduce or verify the behavior.

## Source of truth

The repository and its automated tests are the executable source of truth. This handbook explains intent and operation. If documentation and code disagree, investigate the discrepancy rather than silently assuming either one is correct.

The permanent known-green historical reference branch is `baseline/clean-local-tools-ci-v1`. It must not be moved unless the project owner explicitly decides to redefine that baseline.

## Current architecture in one sentence

Clean Local Tools is primarily a static HTML/CSS/JavaScript application hosted on GitHub Pages, with user-file processing performed in the browser and automated quality gates covering static invariants plus Chromium, desktop WebKit, and mobile WebKit workflows.

## Stewardship

The project is intended to outlive any single maintainer, including its founder. No essential operating knowledge should exist only in one person's memory, laptop, private notes, or AI conversation history.
