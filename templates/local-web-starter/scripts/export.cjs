const fs = require('node:fs'), path = require('node:path');
const source = path.resolve(__dirname, '..'), target = process.argv[2];
if (!target || !path.isAbsolute(target) || fs.existsSync(target) || path.resolve(target).startsWith(source + path.sep)) throw Error('Provide a new, nonexistent absolute destination outside the starter.');
const omit = new Set(['node_modules','dist','.git','playwright-report','test-results']);
fs.cpSync(source, target, { recursive:true, filter(file) {
  const name = path.basename(file);
  return !omit.has(name) && !name.startsWith('.env') && !/\.(pem|key)$/.test(name) && !fs.lstatSync(file).isSymbolicLink();
}});
console.log('Starter copied to '+target+'. Read README.md and AGENTS.md before editing.');
