const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
function read(relative){return fs.readFileSync(path.join(root, relative), 'utf8');}

test('homepage brand documentation preserves approved mission and experimental AI boundary',()=>{
  const required=[
    'docs/README.md',
    'docs/01-purpose/mission-and-vision.md',
    'docs/01-purpose/principles.md',
    'docs/03-architecture/architecture-overview.md',
    'docs/03-architecture/hld.md',
    'docs/03-architecture/lld.md',
    'docs/03-architecture/local-ai-models.md'
  ];
  for(const relative of required)assert.ok(fs.existsSync(path.join(root,relative)),relative+' missing');
  const index=read('docs/README.md');
  for(const relative of required.slice(1))assert.ok(index.includes(relative.slice(5)),relative+' not linked from handbook index');
  const mission=read('docs/01-purpose/mission-and-vision.md');
  for(const phrase of ['Democratize useful digital tools','Your files never leave your machine.','Offline is an earned property'])assert.ok(mission.includes(phrase),'mission missing: '+phrase);
  const principles=read('docs/01-purpose/principles.md');
  for(const phrase of ['No advertising as a product dependency','No unnecessary accounts','Privacy is architecture','Local-first does not mean run at any cost'])assert.ok(principles.includes(phrase),'principles missing: '+phrase);
  for(const relative of required.slice(3)){
    const design=read(relative);
    assert.ok(design.includes('**Branch status:**'),
      relative+' must identify its isolated experimental branch status');
  }
  assert.ok(read('docs/03-architecture/local-ai-models.md').includes('deployed from `main`'));
});
test('homepage generated documentation respects public and technical publishing boundaries',()=>{
  const homepage=read('index.html');
  assert.ok(homepage.includes('href="/about/"'),'homepage should link to About');
  for(const relative of ['about/index.html','principles/index.html']){
    const html=read(relative);
    assert.ok(html.includes('Generated from docs/'),relative+' should identify its Markdown source');
    assert.ok(!html.includes('/assets/style.css'),relative+' should not inherit tool-page layout styles');
    assert.ok(html.includes('/assets/site.css'),relative+' should use the shared site shell');
    assert.ok(html.includes('/assets/docs.css'),relative+' should use the documentation styles');
    assert.ok(html.includes('class="docs-page docs-public brand-page'),relative+' should use a public brand layout');
    assert.doesNotMatch(html,/content="[^"]*noindex/i,relative+' should be indexable');
  }
  const technical=[
    'docs/index.html',
    'docs/architecture/index.html',
    'docs/architecture/hld/index.html',
    'docs/architecture/lld/index.html',
    'docs/architecture/local-ai-models/index.html'
  ];
  const sitemap=read('sitemap.xml');
  for(const relative of technical){
    const html=read(relative);
    assert.match(html,/<meta name="robots" content="noindex,follow,noarchive">/,relative+' should remain out of search');
    const canonical=html.match(/<link rel="canonical" href="([^"]+)">/);
    assert.ok(canonical,relative+' canonical missing');
    assert.ok(!sitemap.includes(`<loc>${canonical[1]}</loc>`),relative+' should not be in sitemap');
  }
});

test('CI keeps generated documentation reproducible',()=>{
  const workflow=read('.github/workflows/tests.yml');
  const pkg=JSON.parse(read('package.json'));
  assert.ok(workflow.includes('name: Generated documentation'));
  assert.ok(workflow.includes('run: |'));
  assert.ok(workflow.includes('npm run build:docs'));
  assert.ok(workflow.includes('git diff --exit-code -- index.html about principles docs sitemap.xml'));
  assert.ok(workflow.includes('npm run test:docs'));
  assert.equal(pkg.scripts['build:docs'],'node scripts/build-docs.js --write');
  assert.equal(pkg.scripts['check:docs'],'node scripts/build-docs.js --check');
  assert.equal(pkg.scripts['test:docs'],'node --test tests/static/docs-build.test.js');
});
