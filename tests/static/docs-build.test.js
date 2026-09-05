const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const docs = require('../../scripts/build-docs.js');

test('documentation front matter is parsed without leaking into rendered content',()=>{
  const parsed=docs.parseFrontMatter('---\nrender: true\ntitle: Example\nindex: false\n---\n# Heading\n','example.md');
  assert.deepEqual(parsed.meta,{render:true,title:'Example',index:false});
  assert.equal(parsed.body,'# Heading\n');
});

test('documentation renderer escapes HTML and rewrites published Markdown links',()=>{
  const routes=new Map([
    ['docs/source.md','/source/'],
    ['docs/architecture.md','/docs/architecture/']
  ]);
  const html=docs.renderMarkdown('# Safe\n\n**Local** <script>alert(1)</script> [Architecture](architecture.md)\n\n```html\n<strong>code</strong>\n```\n','docs/source.md',routes);
  assert.match(html,/<h1 id="safe">Safe<\/h1>/);
  assert.match(html,/<strong>Local<\/strong> &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html,/href="\/docs\/architecture\/"/);
  assert.match(html,/&lt;strong&gt;code&lt;\/strong&gt;/);
});

test('generated documentation is current and keeps public pages separate from technical pages',()=>{
  const result=docs.checkBuild(root);
  assert.equal(result.pages.length,7);
  const byRoute=new Map(result.pages.map(page=>[page.meta.route,page]));
  assert.equal(byRoute.get('/about/').meta.index,true);
  assert.equal(byRoute.get('/principles/').meta.index,true);
  for(const route of ['/docs/','/docs/architecture/','/docs/architecture/hld/','/docs/architecture/lld/','/docs/architecture/local-ai-models/']){
    assert.equal(byRoute.get(route).meta.index,false,route+' should remain technical/noindex');
  }
});

test('generated pages use the standalone open editorial shell',()=>{
  const pages=docs.collectPages(root);
  const publicPage=pages.find(page=>page.meta.route==='/about/');
  const technicalPage=pages.find(page=>page.meta.route==='/docs/architecture/');
  const routes=new Map(pages.map(page=>[page.source,page.meta.route]));
  const publicHtml=docs.renderPage(publicPage,routes);
  const technicalHtml=docs.renderPage(technicalPage,routes);
  assert.match(publicHtml,/<body class="docs-page docs-public">/);
  assert.match(technicalHtml,/<body class="docs-page docs-technical">/);
  assert.match(publicHtml,/<link rel="stylesheet" href="\/assets\/docs\.css">/);
  assert.doesNotMatch(publicHtml,/\/assets\/style\.css/);
  const css=require('node:fs').readFileSync(path.join(root,'assets/docs.css'),'utf8');
  assert.match(css,/\.docs-page \.wrap\{width:min\(1040px,calc\(100% - 40px\)\)/);
  assert.match(css,/\.doc-article\{[^}]*background:transparent;border:0;border-radius:0;box-shadow:none/);
  assert.match(css,/\.doc-content\{max-width:760px\}/);
});
