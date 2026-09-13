const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'dist');
const escape = s => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function markdown(source) {
  // Deliberately small trusted-repository Markdown subset; never raw HTML.
  let code = false;
  return source.split('\n').map(line => {
    if (line.startsWith('~~~')) { code = !code; return code ? '<pre><code>' : '</code></pre>'; }
    if (code) return escape(line) + '\n';
    const heading = line.match(/^(#{1,3}) (.*)$/);
    if (heading) return '<h'+heading[1].length+'>'+escape(heading[2])+'</h'+heading[1].length+'>';
    return line ? '<p>'+escape(line)+'</p>' : '';
  }).join('\n') + (code ? '</code></pre>' : '');
}
function build() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
  const origin = new URL(config.origin);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw Error('Configure a bare HTTPS origin.');
  const preview = process.env.CF_PAGES_BRANCH ? process.env.CF_PAGES_BRANCH !== config.productionBranch : true;
  if (!preview && origin.hostname.endsWith('.invalid')) throw Error('Set your real production origin in site.config.json before deploying main.');
  // This exact generated directory is owned by the build; never remove a caller-supplied path.
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(root, 'public'), out, { recursive: true });
  const index = fs.readFileSync(path.join(out, 'index.html'), 'utf8').replaceAll('{{NAME}}', escape(config.name)).replaceAll('{{ORIGIN}}', escape(origin.origin));
  fs.writeFileSync(path.join(out, 'index.html'), index);
  fs.mkdirSync(path.join(out, 'docs'), { recursive: true });
  const docs = fs.readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md')).sort();
  for (const file of docs) {
    const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>'+escape(file.replace('.md',''))+' — Handbook</title><link rel="stylesheet" href="/style.css"><header><a href="/">Home</a><a href="/docs/">Handbook</a></header><main>'+markdown(fs.readFileSync(path.join(root,'docs',file),'utf8'))+'</main></html>';
    fs.writeFileSync(path.join(out,'docs',file.replace('.md','.html')),html);
  }
  fs.writeFileSync(path.join(out,'docs','index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>Handbook</title><link rel="stylesheet" href="/style.css"><main><h1>Handbook</h1>'+docs.map(f=>'<p><a href="'+encodeURIComponent(f.replace('.md','.html'))+'">'+escape(f.replace('.md',''))+'</a></p>').join('')+'</main></html>');
  fs.writeFileSync(path.join(out, '_headers'), '/*\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data: blob:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; frame-ancestors \'none\'\n'+(preview?'  X-Robots-Tag: noindex, nofollow\n':'')+'/docs/*\n  X-Robots-Tag: noindex, follow\n');
  fs.writeFileSync(path.join(out, 'robots.txt'), preview?'User-agent: *\nDisallow: /\n':'User-agent: *\nAllow: /\nSitemap: '+origin.origin+'/sitemap.xml\n');
  fs.writeFileSync(path.join(out, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+(preview?'':'<url><loc>'+origin.origin+'/</loc></url>')+'</urlset>\n');
}
if (require.main === module) build();
module.exports = { markdown, build };
