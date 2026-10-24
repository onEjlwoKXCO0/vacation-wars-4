// Bundles the client into a single self-contained HTML page.
//   node scripts/build.js          → public/index.html (served by the multiplayer server)
//   node scripts/build.js --demo   → dist/vacation-wars-4-solo.html (offline solo demo, no server needed)
//   node scripts/build.js --watch  → rebuild public/index.html on change
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const demo = process.argv.includes('--demo');
const watch = process.argv.includes('--watch');

const options = {
  entryPoints: [new URL('client/main.js', root).pathname],
  bundle: true, format: 'iife', minify: !watch, write: false, target: ['es2020'], legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
};

function emit(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  // Country-flag emoji font (Twemoji, CC-BY 4.0) so flags render on Windows too — limited to the flag code points.
  const flagFont = readFileSync(new URL('assets/fonts/TwemojiCountryFlags.woff2', root)).toString('base64');
  const fontFace = `@font-face { font-family: "Twemoji Country Flags"; unicode-range: U+1F1E6-1F1FF, U+1F3F4, U+E0062-E0063, U+E0065, U+E0067, U+E006C, U+E006E, U+E0073-E0074, U+E0077, U+E007F; src: url(data:font/woff2;base64,${flagFont}) format('woff2'); font-display: swap; }\n`;
  const css = fontFace + readFileSync(new URL('client/styles.css', root), 'utf8') + '\n' + readFileSync(new URL('client/styles2.css', root), 'utf8');
  let page = readFileSync(new URL('client/index.html', root), 'utf8')
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => (demo ? 'window.VW4_DEMO=true;\n' : '') + js);
  if (demo) {
    mkdirSync(new URL('dist/', root), { recursive: true });
    const out = new URL('dist/vacation-wars-4-solo.html', root);
    writeFileSync(out, page);
    console.log('built', out.pathname, `${(page.length / 1024).toFixed(0)} KB`);
  } else {
    page = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#05060d">\n</head>\n<body>\n${page}\n</body>\n</html>\n`;
    mkdirSync(new URL('public/', root), { recursive: true });
    const out = new URL('public/index.html', root);
    writeFileSync(out, page);
    console.log('built', out.pathname, `${(page.length / 1024).toFixed(0)} KB`);
  }
}

if (watch) {
  const ctx = await context({ ...options, plugins: [{ name: 'emit', setup(b) { b.onEnd((r) => { if (!r.errors.length) emit(r); }); } }] });
  await ctx.watch();
  console.log('watching client/ …');
} else {
  emit(await build(options));
}
