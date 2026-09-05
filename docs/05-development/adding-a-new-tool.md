# Adding a New Tool

## Purpose

This is the repeatable path for adding a Clean Local Tools utility without relying on tribal knowledge.

## Before coding

Answer these questions in plain language:

1. What ordinary-person problem does the tool solve?
2. Why is local/browser processing valuable for this problem?
3. What file/data enters the tool?
4. Does any working data need to leave the device? If yes, the feature does not qualify for the standard local-only privacy promise without an explicit architectural/product decision.
5. Which browser APIs and third-party dependencies are required?
6. What happens in Safari/WebKit and on mobile?
7. What are the expected memory/performance limits?
8. What is the simplest useful V1?

Avoid building a technology demo in search of a user problem.

## Standard workflow

```text
Idea
  |
Product/privacy fit
  |
Architecture + trust-boundary check
  |
Define V1 and failure behavior
  |
Implement + tests together
  |
Static checks
  |
Chromium deep workflow
  |
WebKit/mobile compatibility where applicable
  |
SEO/catalog/sitemap/documentation
  |
Real CI green
  |
Review
  |
Merge/release
```

## Implementation checklist

### Product

- Clear name and purpose.
- Useful without an account.
- Nontechnical instructions.
- Privacy statement accurately matches behavior.
- No unnecessary advertising/tracking/data collection.

### Architecture

- Working files stay local for a local-only tool.
- Expensive work evaluated for a worker.
- Advanced browser APIs use capability detection.
- Fallback behavior is deliberate.
- External dependencies are version-controlled/pinned where feasible.
- Large-file memory behavior is considered.

### UX

- Matches the established Clean Local Tools visual system unless a deliberate redesign is approved.
- Works at representative mobile width without horizontal overflow.
- Errors explain what happened and what the user can do.
- Downloaded output has a sensible filename.
- Accessibility basics are present: labels, semantic controls, keyboard behavior where relevant, readable contrast.

### Search/discovery

- Unique title and meta description.
- Correct canonical URL.
- Linked from the appropriate homepage/catalog group.
- Added to sitemap.
- Search wording describes the real tool rather than stuffing unrelated keywords.

### Tests

At minimum consider:

- route loads;
- main heading and privacy copy;
- primary happy-path workflow;
- output/result assertion;
- malformed/unsupported input;
- important fallback/error path;
- mobile overflow/regression smoke;
- WebKit compatibility where browser APIs differ;
- no-working-file-network-transmission assertion for sensitive/new processing architectures where practical.

### Documentation

Update this handbook when the tool introduces:

- a new shared dependency;
- a new browser capability;
- a new trust boundary;
- a new storage mechanism;
- a new local-AI model/runtime;
- a new deployment/operations requirement;
- a meaningful architectural decision.

## AI-enabled tools

Do not let a page instantiate arbitrary AI infrastructure directly if the shared local-AI foundation can own that responsibility.

Prefer:

```text
Tool -> semantic model adapter -> local AI runtime -> WebGPU/fallback
```

A model should have a documented purpose, source/license, approximate download size, expected memory needs, supported backends, fallback behavior, and test fixture/verification strategy.

Do not silently fall back to cloud AI for a feature advertised as local/private.

## Identity-document exception

Passport/identity-photo tools must not use generative facial reconstruction or beautification. AI may assist with analysis/segmentation/checks only when the implementation preserves the person's actual identity pixels according to the project's documented constraints.

## Definition of done

A tool is done when the useful workflow works, important failure behavior is defined, corresponding tests exist, required CI is green, catalog/search metadata is correct, and documentation accurately describes any new architecture.

“Works on my browser” is not the release criterion.
