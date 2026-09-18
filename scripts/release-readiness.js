'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { toolContracts, risks } = require('../tests/tool-contracts');

const root = path.resolve(__dirname, '..');
const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA || 'HEAD';

function changedFiles() {
  if (base) return execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  return execFileSync('git', ['diff', '--name-only', 'HEAD^', head], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
}

function affects(contract, files) {
  const routePath = contract.route === '/' ? 'index.html' : contract.route.replace(/^\//, '').replace(/\/$/, '');
  return files.some(file => file === routePath || file.startsWith(`${routePath}/`) || file === `src/pages/${routePath}/index.astro` || file === `src/pages/${routePath}.astro` || file === `tests/${contract.deepSpec}`);
}

const files = changedFiles();
const affected = toolContracts.filter(contract => affects(contract, files));
const sharedVisualChange = files.some(file => file === 'src/styles/global.css' || file === 'src/styles/tool-system.css' || file.startsWith('src/components/') || file.startsWith('src/layouts/'));
const requiredRisks = new Set(affected.map(contract => contract.risk));
if (sharedVisualChange) requiredRisks.add('visual');
if (!requiredRisks.size) requiredRisks.add('standard');
const ranked = ['new-tool', 'device-input', 'native-output', 'visual', 'standard'];
const highest = ranked.find(risk => requiredRisks.has(risk));
const manualChecks = affected.filter(contract => risks[contract.risk].manual).map(contract => `- **${contract.id}** — ${contract.manualCheck}`);
const labels = [...requiredRisks].map(risk => risks[risk].label);
const lines = [
  '## Release readiness',
  '',
  `Recommended risk label(s): ${labels.map(label => `\`${label}\``).join(', ')}`,
  '',
  `Highest risk: **${highest}** — ${risks[highest].summary}`,
  '',
  affected.length ? `Affected tool contracts: ${affected.map(contract => `\`${contract.id}\``).join(', ')}` : 'Affected tool contracts: none (documentation or infrastructure only).',
  '',
  '### Required evidence',
  '- Static checks, deep Chromium, desktop WebKit, and iPhone-WebKit smoke must be green.',
  '- Review any visual-regression diff; reference images are updated only for intentional approved design changes.',
  '- The owner still gives explicit final release approval for the reviewed SHA.',
  '',
  '### Physical check for this release batch',
  ...(manualChecks.length ? manualChecks : ['- None. This change is eligible for approval from automated evidence and review alone.']),
  '',
  'A release batch may group several green PRs. Test each device-dependent capability once against the exact release-candidate SHA; a new substantive commit resets that evidence.'
];

const report = { files, affected: affected.map(contract => contract.id), labels, highestRisk: highest, manualChecks };
fs.writeFileSync(path.join(root, 'release-readiness.json'), `${JSON.stringify(report, null, 2)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
