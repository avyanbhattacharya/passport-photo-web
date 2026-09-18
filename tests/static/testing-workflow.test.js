const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { toolContracts, risks } = require('../tool-contracts');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('every public route has a declared risk and cross-browser contract', () => {
  const ids = new Set();
  const routes = new Set();
  for (const contract of toolContracts) {
    assert.ok(contract.id && !ids.has(contract.id), `duplicate or missing id: ${contract.id}`);
    assert.ok(contract.route && !routes.has(contract.route), `duplicate or missing route: ${contract.route}`);
    assert.ok(contract.heading instanceof RegExp, `${contract.id} heading must be a RegExp`);
    assert.ok(risks[contract.risk], `${contract.id} has an unknown risk: ${contract.risk}`);
    ids.add(contract.id);
    routes.add(contract.route);
  }
  assert.ok(ids.has('sheetlocal'));
  assert.ok(toolContracts.filter(contract => risks[contract.risk].manual).every(contract => contract.manualCheck));
  assert.match(read('tests/all-tools-regression.spec.js'), /toolContracts/);
});

test('visual review and release readiness remain bounded and intentional', () => {
  const pkg = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/tests.yml');
  const visual = read('tests/visual-regression.spec.js');
  const release = read('scripts/release-readiness.js');
  const collaboration = read('docs/04-workflow/agent-collaboration.md');

  assert.equal(pkg.scripts['test:visual'], 'playwright test --project=chromium tests/visual-regression.spec.js');
  assert.match(pkg.scripts['test:visual:reference'], /VISUAL_BASELINE_CAPTURE=1/);
  assert.match(visual, /Awaiting an approved visual baseline/);
  assert.match(visual, /maxDiffPixelRatio: 0\.005/);
  assert.match(workflow, /name: Release readiness summary/);
  assert.match(workflow, /name: Visual regression/);
  assert.match(workflow, /name: Generate visual review packet/);
  assert.match(read('tests/tool-contracts.js'), /risk:new-tool/);
  assert.match(release, /release batch/);
  assert.match(collaboration, /Risk-based release evidence/);
});
