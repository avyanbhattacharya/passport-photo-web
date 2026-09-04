const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('hardware preview branch has its own CI lane without changing production deployment', () => {
  const workflow = read('.github/workflows/tests.yml');
  const packageJson = JSON.parse(read('package.json'));
  const lab = read('labs/local-ai/index.html');
  assert.ok(workflow.includes('- test/webgpu-hardware-preview-v1'), 'preview branch should trigger quality gates directly');
  assert.ok(workflow.includes('branches: [main]'), 'production pull-request gate should still target main');
  assert.ok(packageJson.scripts['test:static:local-ai'].includes('tests/static/test-report.test.js'), 'hardware report static tests must run in the local AI gate');
  assert.match(lab, /name="robots" content="noindex,nofollow"/i, 'hardware lab must stay out of search indexes');
  assert.match(lab, /No test report is submitted automatically/i);
  assert.match(lab, /Copy Test Report/);
  assert.match(lab, /Download Test Report \(\.json\)/);
});
