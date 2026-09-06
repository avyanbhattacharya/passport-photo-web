const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process'), os=require('node:os');
const root=path.resolve(__dirname,'..'), {markdown}=require('../scripts/build.cjs');
test('docs escape markup and preserve code blocks',()=>{assert.ok(markdown('# <img src=x>').includes('&lt;img'));assert.ok(markdown('~~~\nhello\n~~~').includes('<pre><code>'));});
test('preview build excludes private source and emits noindex headers',()=>{
  cp.execFileSync(process.execPath,['scripts/build.cjs'],{cwd:root,env:{...process.env,CF_PAGES_BRANCH:'feature/test'}});
  const headers=fs.readFileSync(path.join(root,'dist/_headers'),'utf8');
  assert.match(headers,/X-Robots-Tag: noindex/);assert.match(headers,/connect-src 'none'/);
  assert.ok(!fs.existsSync(path.join(root,'dist/package.json'))); assert.ok(!fs.existsSync(path.join(root,'dist/AGENTS.md')));
  assert.ok(fs.existsSync(path.join(root,'dist/docs/index.html')));
});
test('export includes dotfiles and refuses overwrite',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'local-starter-test-')), target=path.join(dir,'new-project');
  cp.execFileSync(process.execPath,['scripts/export.cjs',target],{cwd:root});
  assert.ok(fs.existsSync(path.join(target,'.github/workflows/quality.yml')));
  assert.ok(!fs.existsSync(path.join(target,'node_modules')));
  assert.throws(()=>cp.execFileSync(process.execPath,['scripts/export.cjs',target],{cwd:root,stdio:'pipe'}));
  fs.rmSync(dir,{recursive:true,force:true});
});
