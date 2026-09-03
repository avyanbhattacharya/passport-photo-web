const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const privacy = 'Your files never leave your machine.';
const pages = [
  ['/', 'index.html', 'https://cleanlocaltools.com/'],
  ['/passport-photo/', 'passport-photo/index.html', 'https://cleanlocaltools.com/passport-photo/'],
  ['/japa-counter/', 'japa-counter/index.html', 'https://cleanlocaltools.com/japa-counter/'],
  ['/japa-counter/tap.html', 'japa-counter/tap.html', 'https://cleanlocaltools.com/japa-counter/tap.html'],
  ['/compress-pdf/', 'compress-pdf/index.html', 'https://cleanlocaltools.com/compress-pdf/'],
  ['/merge-pdf/', 'merge-pdf/index.html', 'https://cleanlocaltools.com/merge-pdf/'],
  ['/resize-image/', 'resize-image/index.html', 'https://cleanlocaltools.com/resize-image/'],
  ['/clean-pdf-printer/', 'clean-pdf-printer/index.html', 'https://cleanlocaltools.com/clean-pdf-printer/'],
  ['/document-flattener/', 'document-flattener/index.html', 'https://cleanlocaltools.com/document-flattener/'],
  ['/image-to-pdf/', 'image-to-pdf/index.html', 'https://cleanlocaltools.com/image-to-pdf/'],
  ['/split-pdf/', 'split-pdf/index.html', 'https://cleanlocaltools.com/split-pdf/'],
  ['/heic-to-jpg/', 'heic-to-jpg/index.html', 'https://cleanlocaltools.com/heic-to-jpg/'],
  ['/remove-photo-metadata/', 'remove-photo-metadata/index.html', 'https://cleanlocaltools.com/remove-photo-metadata/'],
  ['/qr-code-maker/', 'qr-code-maker/index.html', 'https://cleanlocaltools.com/qr-code-maker/']
];
const homepageRoutes = pages.slice(1).map(([route]) => route).filter(route => route !== '/japa-counter/tap.html');
function read(relative){return fs.readFileSync(path.join(root, relative), 'utf8');}
function appSourceFor(htmlPath){const appPath=path.join(path.dirname(htmlPath),'app.js'),absolute=path.join(root,appPath);return fs.existsSync(absolute)?fs.readFileSync(absolute,'utf8'):'';}
function escapeRegex(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function descriptionContent(html){const match=html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);return match?match[1]:'';}

test('all public pages have canonical, indexable, privacy-aware metadata',()=>{for(const[route,htmlPath,canonical]of pages){const html=read(htmlPath),runtime=appSourceFor(htmlPath),searchable=`${html}\n${runtime}`;assert.match(html,new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${escapeRegex(canonical)}["']`,'i'),`${route} canonical`);assert.doesNotMatch(html,/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i,`${route} must remain indexable`);assert.ok(searchable.includes(privacy),`${route} privacy tagline`);const description=descriptionContent(html),runtimeInjectsPrivacy=runtime.includes(privacy)&&runtime.includes('meta[name="description"]')&&runtime.includes('PRIVACY_TAGLINE');assert.ok(description.includes(privacy)||runtimeInjectsPrivacy,`${route} search description privacy copy`);}});
test('sitemap contains every public canonical URL',()=>{const sitemap=read('sitemap.xml');for(const[,,canonical]of pages)assert.ok(sitemap.includes(`<loc>${canonical}</loc>`),`${canonical} missing from sitemap`);});
test('homepage links to every catalog tool route',()=>{const homepage=read('index.html');for(const route of homepageRoutes){const relative=route.replace(/^\//,'');assert.ok(homepage.includes(`href="${route}"`)||homepage.includes(`href='${route}'`)||homepage.includes(`href="${relative}"`)||homepage.includes(`href='${relative}'`),`${route} missing from homepage`);}});
test('browser tests avoid fixed sleeps and runaway assertion timeouts',()=>{const testsDir=path.join(root,'tests'),specs=fs.readdirSync(testsDir).filter(name=>name.endsWith('.spec.js'));for(const spec of specs){const source=fs.readFileSync(path.join(testsDir,spec),'utf8');assert.doesNotMatch(source,/waitForTimeout\s*\(/,`${spec} contains a fixed sleep`);for(const match of source.matchAll(/timeout\s*:\s*(\d+)/g))assert.ok(Number(match[1])<=30000,`${spec} contains timeout ${match[1]}ms`);}});
test('every tool family keeps a dedicated deep browser spec',()=>{const expected=['passport-photo.spec.js','japa-touchless.spec.js','japa-tap.spec.js','compress-pdf.spec.js','merge-pdf.spec.js','resize-image.spec.js','clean-pdf-printer.spec.js','document-flattener.spec.js','image-to-pdf.spec.js','split-pdf.spec.js','heic-to-jpg.spec.js','remove-photo-metadata.spec.js','qr-code-maker.spec.js'];for(const spec of expected)assert.ok(fs.existsSync(path.join(root,'tests',spec)),`${spec} missing`);});
test('CI keeps bounded, fail-fast static, Chromium, and compatibility gates',()=>{const workflow=read('.github/workflows/tests.yml'),config=read('playwright.config.js'),pkg=JSON.parse(read('package.json'));assert.match(workflow,/static:\s*[\s\S]*timeout-minutes:\s*3/);assert.match(workflow,/chromium:\s*[\s\S]*timeout-minutes:\s*8/);assert.match(workflow,/compatibility:\s*[\s\S]*timeout-minutes:\s*6/);assert.ok(workflow.includes('npx playwright install --with-deps chromium'));assert.ok(workflow.includes('npx playwright install --with-deps webkit'));assert.ok(workflow.includes('cancel-in-progress: true'));assert.doesNotMatch(workflow,/continue-on-error:\s*true/);assert.doesNotMatch(workflow,/Enforce (static checks|deep Chromium result|compatibility result)/);for(const stepName of ['Site metadata and catalog','Test architecture and hygiene','Core and Japa deep tests','PDF deep tests','Image and catalog deep tests','Desktop WebKit smoke','iPhone WebKit smoke'])assert.ok(workflow.includes(`name: ${stepName}`),`missing diagnostic step ${stepName}`);assert.equal(pkg.scripts['test:static'],'node --test tests/static/*.test.js');assert.ok(pkg.scripts['test:chromium:core']);assert.ok(pkg.scripts['test:chromium:pdf']);assert.ok(pkg.scripts['test:chromium:image']);assert.ok(pkg.scripts['test:compat:webkit']);assert.ok(pkg.scripts['test:compat:mobile']);assert.ok(config.includes('timeout: 30000'));assert.ok(config.includes("trace: 'on-first-retry'"));assert.ok(config.includes('all-tools-regression\\.spec\\.js'));});
