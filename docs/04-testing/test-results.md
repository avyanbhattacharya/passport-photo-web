# Test Results and Evidence

## Purpose

This page records significant quality-gate evidence and explains how to interpret it. It is not intended to become a hand-maintained list of every CI run forever.

The authoritative current result is the latest required GitHub Actions run for the commit/PR being evaluated.

## Known-green historical baseline

Branch:

`baseline/clean-local-tools-ci-v1`

Commit:

`b00b46fda186831d7a1ae006e1eec39ddc61bcd6`

This branch was intentionally frozen as a reusable known-green reference for the Clean Local Tools application and CI foundation. It should not be moved during ordinary development.

The warm quality-gate run used when establishing that CI baseline was run `33800087515`. At that point typical warm wall-clock time was approximately one minute, with browser installation skipped on cache hits. Runtime can vary substantially with GitHub-hosted runner and package-network conditions.

## Local AI / WebGPU Foundation V1 evidence

Feature branch:

`feature/webgpu-ai-foundation-v1`

Pull request quality-gate run:

`33830703449`

Head commit at successful run:

`7c9182c3520392b303b58a8080f37825a8af2050`

Result:

```text
Quality gates                         PASS

Static checks                         PASS
  Site metadata and catalog           PASS
  Test architecture and hygiene       PASS
  Local AI foundation                 PASS

Deep Chromium                         PASS
  Core, Japa, local AI deep tests     PASS
  PDF deep tests                      PASS
  Image and catalog deep tests        PASS

WebKit and iPhone smoke               PASS
  Desktop WebKit smoke                PASS
  iPhone WebKit smoke                 PASS
```

What this proves:

- the feature branch passed the repository's required automated quality architecture at that commit;
- local-AI foundation static assertions passed;
- local-AI browser tests passed in Chromium;
- the broader existing tool suite remained green in its configured deep groups;
- desktop and mobile WebKit smoke remained green.

What this does **not** prove:

- that every physical Chrome/Safari device has a working GPU configuration;
- that Playwright WebKit is identical to every shipping Safari build;
- that a physical iPhone GPU exercised WebGPU during CI;
- that future real AI models will have the same performance/memory behavior as the foundation test workload;
- that the whole site is offline-ready.

## Performance observation from the AI foundation run

The AI foundation run was slower than the previously observed warm baseline because dependency installation on GitHub-hosted runners took several minutes. The actual browser test phases were comparatively short. Treat individual CI duration as an observation rather than a performance guarantee.

## Recording future milestones

Add an entry here when a result establishes a meaningful architectural milestone, for example:

- first real local model running through WebGPU plus fallback;
- first automated no-working-file-network-leak test;
- first Offline Ready tool proven under network isolation;
- major CI architecture change;
- major browser compatibility expansion.

For each milestone record:

- branch/tag/commit;
- CI run identifier;
- important gates and results;
- what the evidence proves;
- what it explicitly does not prove;
- relevant runtime/performance observations.

This prevents future maintainers or AI agents from turning a green badge into a broader claim than the test actually supports.
