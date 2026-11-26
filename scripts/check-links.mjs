// Link checker for the built site: every relative href/src in dist/**/*.html must point to a file or route that exists.
// Usage: pnpm build && node scripts/check-links.mjs   (exit 1 when something is broken)
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
if (!fs.existsSync(dist)) { console.error('dist not found, run the build first'); process.exit(2); }

const htmlFiles = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith('.html')) htmlFiles.push(full);
  }
})(dist);

const exists = target => {
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return true;
  return fs.existsSync(path.join(target, 'index.html'));
};

const broken = [];
const preJs = [];
let checked = 0;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/\s(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/gu)) {
    const url = match[1];
    if (/^(?:[a-z]+:|\/\/|data:|mailto:|tel:)/iu.test(url)) continue;
    checked += 1;
    const base = url.startsWith('/') ? dist : path.dirname(file);
    const target = path.normalize(path.join(base, url));
    if (exists(target)) continue;
    const page = path.relative(dist, file);
    // Nested entry pages are copies of index.html, so their handwritten ./ nav links only resolve after app.js rewrites them.
    if (url.startsWith('./') && page !== 'index.html' && page !== '404.html') preJs.push(`${page} -> ${url}`);
    else broken.push(`${page} -> ${url}`);
  }
}
console.log(`pages: ${htmlFiles.length}, relative links checked: ${checked}, broken: ${broken.length}, only-valid-after-JS (warning): ${preJs.length}`);
for (const line of [...new Set(broken)].slice(0, Number(process.env.MAX_LINES ?? 50))) console.log('BROKEN', line);
process.exit(broken.length ? 1 : 0);
