// falo3d-2/workshop-loader.js
// Boots a workshop .jsx file in the browser with no build step.
//
// The workshops are plain React + Three.js source files. Rather than stand up
// a bundler (this repo has no node_modules, and the local Node is v16/EOL),
// we fetch the .jsx as text, transpile it with Babel standalone, hand the
// result to the browser as a blob module, and render its default export.
//
// Bare imports inside the blob module ("react", "three", ...) resolve through
// the <script type="importmap"> in the host HTML — import maps apply to blob:
// modules the same as to file-served ones.

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';

/** Paint a readable error onto the page — the console isn't always in view. */
function showError(title, err) {
  const msg = (err && (err.stack || err.message)) || String(err);
  document.getElementById('root').innerHTML = `
    <div style="max-width:900px;margin:40px auto;padding:20px 24px;
                background:#1a0e12;border:1px solid #512;border-radius:8px;
                font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f88">
      <div style="font-weight:700;letter-spacing:2px;text-transform:uppercase;
                  color:#f44;margin-bottom:10px">${title}</div>
      <pre style="white-space:pre-wrap;margin:0;color:#fbb">${
        msg.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))
      }</pre>
    </div>`;
}

/**
 * Reload the page whenever the source file changes on disk.
 *
 * python's http.server sends Last-Modified on static files, so a periodic
 * HEAD is enough to notice an edit. This is the poor-man's HMR that makes
 * the workshop usable as a live editing surface.
 */
function watch(url, intervalMs = 1000) {
  let stamp = null;
  setInterval(async () => {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const mod = res.headers.get('Last-Modified');
      if (stamp === null) stamp = mod;
      else if (mod !== stamp) location.reload();
    } catch { /* server restarting — ignore and retry */ }
  }, intervalMs);
}

/**
 * Rewrite every non-bare import in the transpiled source to an absolute URL.
 *
 * A blob: URL has no directory to resolve against, so "./x.js" and
 * "/src/x.js" both fail inside a blob module — the browser reports the base
 * scheme as not hierarchical. Bare names ("react", "three") are deliberately
 * left alone: the host page's import map still covers those, and rewriting
 * them would break it.
 *
 * This is what lets a workshop import the real game source out of /src/ and
 * drive the actual code instead of a copy of it.
 */
function absolutise(code, jsxUrl) {
  const base = new URL(jsxUrl, location.href);
  return code.replace(
    /(\bfrom\s*|\bimport\s*\(\s*)(['"])((?:\.{1,2})?\/[^'"]*)\2/g,
    (_m, kw, q, spec) => `${kw}${q}${new URL(spec, base).href}${q}`);
}

/**
 * Transpile and mount a workshop.
 *
 * @param {string} jsxUrl — path to the .jsx file, relative to this page
 */
export async function mountWorkshop(jsxUrl) {
  let source;
  try {
    const res = await fetch(jsxUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${jsxUrl}`);
    source = await res.text();
  } catch (err) {
    return showError('Could not load source', err);
  }

  let code;
  try {
    // runtime:'automatic' emits `import { jsx } from "react/jsx-runtime"`,
    // so the workshop files don't need a default `React` import (they only
    // import the hooks they use).
    ({ code } = Babel.transform(source, {
      filename: jsxUrl,
      presets: [['react', { runtime: 'automatic' }]],
      sourceMaps: 'inline',
    }));
  } catch (err) {
    return showError('JSX syntax error', err);
  }

  let mod;
  try {
    const blob = new Blob([absolutise(code, jsxUrl)], { type: 'text/javascript' });
    mod = await import(/* @vite-ignore */ URL.createObjectURL(blob));
  } catch (err) {
    return showError('Module failed to load', err);
  }

  if (typeof mod.default !== 'function') {
    return showError('No default export', `${jsxUrl} must default-export a React component.`);
  }

  try {
    createRoot(document.getElementById('root')).render(createElement(mod.default));
  } catch (err) {
    return showError('Render failed', err);
  }

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    watch(jsxUrl);
  }
}
