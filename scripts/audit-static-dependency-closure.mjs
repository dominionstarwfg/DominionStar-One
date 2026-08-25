import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const excludedTop = new Set(['.git', '.github', 'dist', 'desktop', 'desktop 2', 'node_modules', 'supabase', 'netlify']);
const missing = new Map();
const checked = new Set();

function walk(dir = root) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dir === root && excludedTop.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function cleanRef(raw = '') {
  let value = String(raw).trim();
  if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:')) return null;
  // Runtime/template expressions are not literal static dependencies. Treating
  // them as filenames creates false failures such as `${esc(url)}`.
  if (value.includes('${') || value.includes('{{') || value.includes('}}') || value.includes('<%') || value.includes('%>')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return null;
  value = value.split('#')[0].split('?')[0];
  try { value = decodeURIComponent(value); } catch {}
  return value || null;
}

function resolveRef(fromFile, ref) {
  const clean = cleanRef(ref);
  if (!clean) return null;
  const abs = clean.startsWith('/')
    ? path.join(root, clean.replace(/^\/+/, ''))
    : path.resolve(path.dirname(fromFile), clean);
  return abs;
}

function record(fromFile, ref, kind) {
  const target = resolveRef(fromFile, ref);
  if (!target) return;
  const rel = path.relative(root, target).replaceAll(path.sep, '/');
  if (rel.startsWith('../')) return;
  checked.add(rel);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    const key = `${rel}\u0000${path.relative(root, fromFile).replaceAll(path.sep, '/')}\u0000${kind}`;
    missing.set(key, { target: rel, from: path.relative(root, fromFile).replaceAll(path.sep, '/'), ref, kind });
  }
}

function recordJsStaticAsset(fromFile, ref, kind) {
  const clean = cleanRef(ref);
  if (!clean) return;
  // JavaScript may assign routes to location.href; those are navigations, not
  // file dependencies. Audit literal asset/file assignments while leaving route
  // semantics to browser acceptance.
  if (!clean.startsWith('/assets/') && !/\.[a-z0-9]{2,8}$/i.test(clean)) return;
  record(fromFile, ref, kind);
}

const files = walk();
for (const file of files) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  if (rel.startsWith('scripts/recovery/')) continue;
  const ext = path.extname(file).toLowerCase();
  if (!['.html', '.css', '.js', '.mjs'].includes(ext)) continue;
  const text = fs.readFileSync(file, 'utf8');

  if (ext === '.html') {
    for (const match of text.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)) record(file, match[2], 'script-src');
    for (const match of text.matchAll(/<link\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) record(file, match[2], 'link-href');
    for (const match of text.matchAll(/<(?:img|source|video|audio|iframe)\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)) record(file, match[2], 'media-src');
    for (const match of text.matchAll(/<(?:video|img)\b[^>]*\bposter\s*=\s*(["'])(.*?)\1/gi)) record(file, match[2], 'poster');
    for (const match of text.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) {
      for (const candidate of match[2].split(',')) record(file, candidate.trim().split(/\s+/)[0], 'srcset');
    }
  }

  // Only parse CSS url(...) from actual CSS files. HTML frequently embeds
  // application JavaScript that calls functions named url(...); scanning the
  // entire document as CSS incorrectly turns function arguments into paths.
  if (ext === '.css') {
    for (const match of text.matchAll(/url\(\s*(["']?)([^)'"\s]+)\1\s*\)/gi)) record(file, match[2], 'css-url');
  }

  if (ext === '.js' || ext === '.mjs') {
    for (const match of text.matchAll(/(?:from\s+|import\s*\()\s*(["'])([^"']+)\1/g)) {
      const spec = match[2];
      if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) record(file, spec, 'js-import');
    }
    // Dynamic loaders are part of the dependency graph too. This catches the
    // class of stale `script.src='/assets/.../retired-file.js'` reference that
    // static HTML inspection cannot see.
    for (const match of text.matchAll(/\.src\s*=\s*(["'])([^"']+)\1/g)) recordJsStaticAsset(file, match[2], 'js-src-assignment');
    for (const match of text.matchAll(/setAttribute\(\s*(["'])src\1\s*,\s*(["'])([^"']+)\2\s*\)/g)) recordJsStaticAsset(file, match[3], 'js-setattribute-src');
  }
}

console.log(`STATIC_DEPENDENCIES_CHECKED=${checked.size}`);
if (missing.size) {
  console.error(`STATIC_DEPENDENCIES_MISSING=${missing.size}`);
  for (const item of [...missing.values()].sort((a,b) => a.target.localeCompare(b.target) || a.from.localeCompare(b.from))) {
    console.error(`MISSING ${item.target} <- ${item.from} (${item.kind}: ${item.ref})`);
  }
  process.exit(1);
}
console.log('STATIC_DEPENDENCY_CLOSURE_OK');
