#!/usr/bin/env node
// Scans icons/<segment>/<tool-id>.{png,webp,jpg,jpeg,svg}, normalizes raster
// images to a small PNG via macOS `sips`, base64-encodes everything, and
// writes the result into Nexus Creator.html between the
// `// CUSTOM_ICONS:START` / `// CUSTOM_ICONS:END` markers.
//
// Usage:  node icons/build.mjs
//
// Safe to re-run any time — it fully replaces the CUSTOM_ICONS block rather
// than appending, and any tool id with no file just falls back to its
// built-in iconSVG() glyph (see toolIconHTML() in the main file).

import { readdirSync, readFileSync, writeFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const HTML_PATH = join(ROOT, '..', 'Nexus Creator.html');
const SEGMENTS = ['video', 'photo', 'audio', 'ai'];
const MAX_DIM = 256; // longest side, px — plenty for a 20-24px grid icon at retina

const KNOWN_IDS = new Set([
  'video-trim','video-crop','video-resize','video-rotate','video-compress','video-convert',
  'video-speed','video-reverse','video-stabilize','video-extract','video-noaudio','video-mute',
  'video-adjust','video-vertical','video-watermark',
  'photo-crop','photo-resize','photo-rotate','photo-compress','photo-convert','photo-effects','photo-watermark',
  'audio-trim','audio-volume','audio-fade','audio-convert','audio-compress','audio-normalize',
  'audio-speed','audio-reverse','audio-pitch','audio-mono',
  'ai-removebg','ai-upscale','ai-subtitle','ai-denoise',
]);

const RASTER_EXT = new Set(['.png', '.webp', '.jpg', '.jpeg']);

function mimeFor(ext) {
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/png';
}

function normalizeRaster(srcPath) {
  // sips resizes in place if given an output path; run in a scratch dir so
  // the user's original file in icons/ is never touched.
  const scratch = mkdtempSync(join(tmpdir(), 'nx-icon-'));
  const out = join(scratch, 'out.png');
  execFileSync('sips', ['-s', 'format', 'png', '-Z', String(MAX_DIM), srcPath, '--out', out], { stdio: 'pipe' });
  const buf = readFileSync(out);
  rmSync(scratch, { recursive: true, force: true });
  return { buf, mime: 'image/png' };
}

// Walks a directory to any depth — files can sit directly in
// icons/<segment>/ or organized into subfolders (icons/video/basic/,
// icons/video/effects/, etc.); only the filename (the tool id) matters.
function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full, out); continue; }
    const ext = extname(entry.name).toLowerCase();
    if (!RASTER_EXT.has(ext) && ext !== '.svg') continue;
    out.push(full);
  }
}

function findIconFiles() {
  const found = new Map(); // id -> absolute path
  for (const seg of SEGMENTS) {
    const files = [];
    walk(join(ROOT, seg), files);
    for (const full of files) {
      const id = basename(full, extname(full));
      found.set(id, full);
    }
  }
  return found;
}

function build() {
  const files = findIconFiles();
  const entries = [];
  const unknown = [];
  const skippedTooBig = [];

  for (const [id, path] of files) {
    if (!KNOWN_IDS.has(id)) { unknown.push(`${id} (${path})`); continue; }

    const ext = extname(path).toLowerCase();
    let dataUri;
    if (ext === '.svg') {
      const svgText = readFileSync(path, 'utf8');
      dataUri = `data:image/svg+xml;base64,${Buffer.from(svgText, 'utf8').toString('base64')}`;
    } else {
      const sizeKB = statSync(path).size / 1024;
      if (sizeKB > 8192) { skippedTooBig.push(`${id} (${sizeKB.toFixed(0)}KB, over 8MB source limit)`); continue; }
      const { buf, mime } = normalizeRaster(path);
      dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    }
    entries.push([id, dataUri]);
  }

  entries.sort(([a], [b]) => a.localeCompare(b));

  const lines = entries.map(([id, uri]) => `  '${id}': '${uri}',`);
  const block = [
    '// CUSTOM_ICONS:START',
    'const CUSTOM_ICONS = {',
    ...lines,
    '};',
    '// CUSTOM_ICONS:END',
  ].join('\n');

  const html = readFileSync(HTML_PATH, 'utf8');
  const markerRe = /\/\/ CUSTOM_ICONS:START[\s\S]*?\/\/ CUSTOM_ICONS:END/;
  if (!markerRe.test(html)) {
    throw new Error('CUSTOM_ICONS markers not found in Nexus Creator.html — has the file structure changed?');
  }
  const patched = html.replace(markerRe, block);
  writeFileSync(HTML_PATH, patched);

  const totalBytes = entries.reduce((sum, [, uri]) => sum + uri.length, 0);
  console.log(`Embedded ${entries.length}/${KNOWN_IDS.size} custom icons (${(totalBytes / 1024).toFixed(0)}KB base64).`);
  const missing = [...KNOWN_IDS].filter(id => !entries.some(([eid]) => eid === id));
  if (missing.length) console.log(`Still using built-in icon (${missing.length}): ${missing.join(', ')}`);
  if (unknown.length) console.log(`Ignored — filename doesn't match a known tool id: ${unknown.join(', ')}`);
  if (skippedTooBig.length) console.log(`Skipped — source file too large: ${skippedTooBig.join(', ')}`);
}

build();
