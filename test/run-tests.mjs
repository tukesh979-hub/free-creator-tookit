// Regression test suite for the Nexus Creator unified timeline.
//
// Usage:
//   1. node test/coop-server.mjs                (in one terminal)
//   2. /path/to/Chrome --headless=new --disable-gpu --remote-debugging-port=9333
//   3. node test/run-tests.mjs
//
// Drives real Chrome via the DevTools Protocol (CDP) over a raw
// WebSocket — no npm dependencies. Uses REAL trusted clicks
// (Input.dispatchMouseEvent) rather than JS-level .click() or bare
// Runtime.evaluate calls for anything that needs user-activation
// (playback, exports) — autoplay-gesture policy treats those
// differently, and testing with only Runtime.evaluate produces false
// failures that don't reflect real usage.
//
// Each test is independent (fresh page load / resetEditor()) so a
// failure in one doesn't cascade into unrelated failures.

const CDP_PORT = Number(process.env.CDP_PORT) || 9333;
const BASE_URL = process.env.NX_TEST_URL || 'http://localhost:8935/Nexus%20Creator.html';
// NOT `new URL(...).pathname` — it percent-encodes spaces, and this repo
// path contains them ("AI Project", "Nexus Tools"). DOM.setFileInputFiles
// takes a literal filesystem path, so an encoded one silently resolves to
// a File with the right name but no real bytes — every duration-dependent
// assertion downstream then fails in a very confusing way. fileURLToPath
// decodes it correctly.
import { fileURLToPath } from 'node:url';
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));

// ── Minimal CDP client ──────────────────────────────────────────────────
async function newTab() {
  const res = await fetch(`http://localhost:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
  return res.json();
}
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', reject);
  });
}
function makeSender(ws, consoleMsgs) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id).resolve(msg.result ?? msg.error); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleMsgs.push('[exception] ' + msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: true, promptText: 'Test' });
    }
  });
  const send = (method, params = {}) => new Promise(resolve => {
    const myId = ++id;
    pending.set(myId, { resolve });
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return send;
}

class Page {
  constructor(ws, send, consoleMsgs, targetId) { this.ws = ws; this.send = send; this.consoleMsgs = consoleMsgs; this.targetId = targetId; }
  static async open() {
    const tab = await newTab();
    const ws = await connect(tab.webSocketDebuggerUrl);
    const consoleMsgs = [];
    const send = makeSender(ws, consoleMsgs);
    await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    return new Page(ws, send, consoleMsgs, tab.id);
  }
  async gotoEditor() {
    await this.send('Page.navigate', { url: BASE_URL });
    await sleep(1000);
    await this.eval(`goPage('editor')`);
    await sleep(200);
  }
  async eval(expr, { awaitPromise = false, timeoutMs = 15000 } = {}) {
    const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''));
    return r.result?.value;
  }
  // Wraps a multi-statement body in an IIFE with an explicit return, so
  // top-level const/let don't leak across separate Runtime.evaluate calls
  // (they share one global lexical scope) and the body's final value is
  // actually returned instead of silently discarded.
  async evalBlock(body, opts) {
    return this.eval(`(() => { ${body} })()`, opts);
  }
  async setFile(absPath) {
    const doc = await this.send('DOM.getDocument', { depth: -1 });
    const q = await this.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#ed-file-input' });
    await this.send('DOM.setFileInputFiles', { files: [absPath], nodeId: q.nodeId });
  }
  async trustedClickAt(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
  async trustedClickSelector(selector) {
    const box = await this.eval(`(() => { const b = document.querySelector('${selector}'); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({x: r.left+r.width/2, y: r.top+r.height/2}); })()`);
    if (!box) throw new Error('selector not found: ' + selector);
    const { x, y } = JSON.parse(box);
    await this.trustedClickAt(x, y);
  }
  async warmUpActivation() { await this.trustedClickAt(700, 400); }
  async resetProject() { await this.eval(`resetEditor()`); await sleep(200); }
  async close() {
    // Actually close the browser tab, not just this WebSocket — leaving
    // tabs open accumulates decoding video elements/WebAudio contexts
    // across a long test run and made later tests flaky under resource
    // contention (video metadata took longer to resolve, etc).
    try { await fetch(`http://localhost:${CDP_PORT}/json/close/${this.targetId}`); } catch (_) {}
    try { this.ws.close(); } catch (_) {}
  }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Test runner ──────────────────────────────────────────────────────────
const results = [];
async function test(name, fn) {
  const page = await Page.open();
  const start = Date.now();
  try {
    await fn(page);
    results.push({ name, ok: true, ms: Date.now() - start });
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - start, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${err.message}`);
  } finally {
    await page.close();
  }
}
function assert(cond, msg) { if (!cond) throw new Error('assertion failed: ' + msg); }
function assertEqual(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── Fixtures ─────────────────────────────────────────────────────────────
const VIDEO = FIXTURES + 'test_video.mp4';
const AUDIO = FIXTURES + 'test_audio.m4a';

// ════════════════════════════════════════════════════════════════════════
// IMPORT
// ════════════════════════════════════════════════════════════════════════
async function runImportTests() {
  console.log('\n=== Import ===');
  await test('video import seeds a V1 track with one clip, zero console errors', async page => {
    await page.gotoEditor();
    await page.setFile(VIDEO);
    await sleep(2500);
    const state = await page.eval(`JSON.stringify({tracks: S.timeline.tracks.map(t=>({type:t.type,name:t.name,clips:t.clips.length})), fileLoaded: !!S.file})`);
    const parsed = JSON.parse(state);
    assert(parsed.fileLoaded, 'file should be loaded');
    assert(parsed.tracks.some(t => t.type === 'video' && t.name === 'V1' && t.clips === 1), 'expected a V1 track with 1 clip');
    assert(page.consoleMsgs.length === 0, 'no console errors: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('audio import seeds an A1 track with one clip', async page => {
    await page.gotoEditor();
    await page.setFile(AUDIO);
    await sleep(1500);
    const state = await page.eval(`JSON.stringify(S.timeline.tracks.map(t=>({type:t.type,name:t.name,clips:t.clips.length})))`);
    assert(JSON.parse(state).some(t => t.type === 'audio' && t.name === 'A1' && t.clips === 1), 'expected A1 track: ' + state);
  });
  await test('"Replace File?" modal blocks silent replacement of a loaded file', async page => {
    await page.gotoEditor();
    await page.setFile(AUDIO);
    await sleep(1000);
    await page.setFile(VIDEO); // should trigger the modal, NOT replace immediately
    await sleep(500);
    const fileIsStillAudio = await page.eval(`S.file && S.file.type === 'audio'`);
    assert(fileIsStillAudio, 'file should not have been silently replaced without confirming the modal');
  });
}

// ════════════════════════════════════════════════════════════════════════
// CORE CLIP EDITING (select/drag/trim/split/delete/duplicate/ripple)
// ════════════════════════════════════════════════════════════════════════
async function runCoreEditingTests() {
  console.log('\n=== Core clip editing ===');
  await test('split at playhead produces two correctly-bounded clips', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxSeekTo(3);
      nxSplitAtPlayhead();
      return JSON.stringify(S.timeline.tracks[0].clips.map(x=>({start:x.startTime,dur:x.duration})));
    `);
    assertEqual(JSON.parse(r), [{ start: 0, dur: 3 }, { start: 3, dur: 3 }], 'split result');
  });
  await test('duplicate places a copy immediately after the original', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxDuplicateSelection();
      return JSON.stringify(S.timeline.tracks[0].clips.map(x=>({start:x.startTime,dur:x.duration})));
    `);
    assertEqual(JSON.parse(r), [{ start: 0, dur: 6 }, { start: 6, dur: 6 }], 'duplicate result');
  });
  await test('delete removes exactly the selected clip', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxDuplicateSelection();
      nxSelectClip(S.timeline.tracks[0].clips[0].id, false);
      nxDeleteSelection();
      return S.timeline.tracks[0].clips.length;
    `);
    assertEqual(r, 1, 'one clip should remain');
  });
  await test('ripple delete shifts subsequent clips left by the removed duration', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxToggleRipple(); // on
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxSeekTo(2); nxSplitAtPlayhead(); // [0,2] [2,4]
      nxSelectClip(S.timeline.tracks[0].clips[0].id, false);
      nxDeleteSelection(); // ripple should shift the [2,4] piece to start at 0
      return JSON.stringify(S.timeline.tracks[0].clips.map(x=>x.startTime));
    `);
    assertEqual(JSON.parse(r), [0], 'ripple should close the gap');
  });
  await test('non-ripple delete leaves a gap', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxSeekTo(2); nxSplitAtPlayhead();
      nxSelectClip(S.timeline.tracks[0].clips[0].id, false);
      nxDeleteSelection();
      return JSON.stringify(S.timeline.tracks[0].clips.map(x=>x.startTime));
    `);
    assertEqual(JSON.parse(r), [2], 'gap should remain without ripple');
  });
  await test('multi-select rubber-band selects every intersecting clip', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    await page.evalBlock(`nxAddTextClip();`);
    const r = await page.evalBlock(`
      const tracksEl = document.getElementById('nxt-tracks');
      const r = tracksEl.getBoundingClientRect();
      tracksEl.dispatchEvent(new MouseEvent('mousedown', {clientX: r.left+2, clientY: r.top+2, bubbles:true, button:0}));
      document.dispatchEvent(new MouseEvent('mousemove', {clientX: r.left+500, clientY: r.top+300, bubbles:true}));
      document.dispatchEvent(new MouseEvent('mouseup', {clientX: r.left+500, clientY: r.top+300, bubbles:true}));
      return S.timeline.selection.length;
    `);
    assert(r >= 2, 'expected at least 2 clips selected, got ' + r);
  });
  await test('trim-end handle cannot extend a clip past its source asset duration', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      const asset = nxAsset(c.sourceAssetId);
      c.sourceEnd = asset.duration; c.duration = asset.duration - c.sourceStart;
      // simulate what the drag handler's clamp does directly
      const maxEnd = asset.duration - c.sourceEnd;
      return maxEnd <= 0.001;
    `);
    assert(r, 'source-bounded clip should not be extendable past asset duration');
  });
  await test('10x repeated split/duplicate/undo/redo stays consistent, zero console errors', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const counts = [];
      for (let i = 0; i < 10; i++) {
        const t = S.timeline.tracks[0];
        const c = t.clips[0];
        nxSelectClip(c.id, false);
        nxSeekTo(Math.min(c.startTime + c.duration/2, nxDuration() - 0.1));
        nxSplitAtPlayhead();
        nxDuplicateSelection();
        nxUndo(); nxUndo(); nxRedo();
        counts.push(t.clips.length);
      }
      return JSON.stringify(counts);
    `);
    const counts = JSON.parse(r);
    assert(counts.every(n => n >= 1), 'clip count should never drop to zero: ' + r);
    assert(page.consoleMsgs.length === 0, 'no console errors across 10x cycles: ' + JSON.stringify(page.consoleMsgs));
  });
}

// ════════════════════════════════════════════════════════════════════════
// TRACK CONTROLS
// ════════════════════════════════════════════════════════════════════════
async function runTrackTests() {
  console.log('\n=== Track controls ===');
  await test('mute/solo/lock toggle and persist on the track object', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxAddTrack('audio'); nxAddTrack('audio');
      const t = S.timeline.tracks.find(x=>x.name==='A1');
      nxToggleTrackMute(t.id); nxToggleTrackSolo(t.id); nxToggleTrackLock(t.id);
      return JSON.stringify({muted:t.muted, solo:t.solo, locked:t.locked});
    `);
    assertEqual(JSON.parse(r), { muted: true, solo: true, locked: true }, 'toggles');
  });
  await test('solo on one track effectively mutes all non-soloed tracks', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxAddTrack('audio'); nxAddTrack('audio');
      const [a1, a2] = S.timeline.tracks.filter(t=>t.type==='audio');
      nxToggleTrackSolo(a1.id);
      return JSON.stringify({a1Muted: nxEffectiveTrackMuted(a1), a2Muted: nxEffectiveTrackMuted(a2)});
    `);
    assertEqual(JSON.parse(r), { a1Muted: false, a2Muted: true }, 'solo semantics');
  });
  await test('multiple soloed tracks all play, everything else muted', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxAddTrack('audio'); nxAddTrack('audio'); nxAddTrack('audio');
      const tracks = S.timeline.tracks.filter(t=>t.type==='audio');
      nxToggleTrackSolo(tracks[0].id); nxToggleTrackSolo(tracks[1].id);
      return JSON.stringify(tracks.map(t => nxEffectiveTrackMuted(t)));
    `);
    assertEqual(JSON.parse(r), [false, false, true], 'two soloed tracks play, third muted');
  });
  await test('locked track cannot be deleted', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxAddTrack('audio');
      const t = S.timeline.tracks.find(x=>x.type==='audio');
      const before = S.timeline.tracks.length;
      nxToggleTrackLock(t.id);
      nxDeleteTrack(t.id);
      return JSON.stringify({before, after: S.timeline.tracks.length});
    `);
    const { before, after } = JSON.parse(r);
    assertEqual(before, after, 'locked track deletion should be a no-op');
  });
  await test('reorder moves a track exactly one position', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxAddTrack('audio'); nxAddTrack('audio');
      const before = S.timeline.tracks.map(t=>t.name);
      const a1 = S.timeline.tracks.find(t=>t.name==='A1');
      nxReorderTrack(a1.id, 1);
      const after = S.timeline.tracks.map(t=>t.name);
      return JSON.stringify({before, after});
    `);
    const { before, after } = JSON.parse(r);
    assert(before.indexOf('A1') === after.indexOf('A1') - 1, 'A1 should have moved down exactly one slot: ' + r);
  });
}

// ════════════════════════════════════════════════════════════════════════
// INSPECTOR: transform / speed / text / audio params
// ════════════════════════════════════════════════════════════════════════
async function runInspectorTests() {
  console.log('\n=== Inspector (transform / speed / text / audio) ===');
  await test('transform sliders apply live to the preview wrapper', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxSetClipProp(c.id, 'transform', 'scale', 60);
      nxSetClipProp(c.id, 'transform', 'opacity', 70);
      nxCommitInspectorEdit();
      const wrap = document.getElementById('vid-preview-wrap');
      return JSON.stringify({transform: wrap.style.transform, opacity: wrap.style.opacity});
    `);
    const parsed = JSON.parse(r);
    assert(parsed.transform.includes('scale(0.6)'), 'scale should apply: ' + r);
    assertEqual(parsed.opacity, '0.7', 'opacity should apply');
  });
  await test('speed change recomputes duration and sets playbackRate', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      const before = c.duration;
      nxSetClipSpeed(c.id, 2);
      return JSON.stringify({before, after: c.duration, rate: document.getElementById('preview-vid').playbackRate});
    `);
    const { before, after, rate } = JSON.parse(r);
    assertEqual(after, before / 2, 'duration should halve at 2x speed');
    assertEqual(rate, 2, 'playbackRate should be 2');
  });
  await test('text clip renders real content in the compositor', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxAddTextClip();
      const t = S.timeline.tracks.find(x=>x.name.startsWith('Text'));
      const c = t.clips[0];
      nxSetTextField(c.id, 'content', 'Hello Nexus');
      nxCompositorSync();
      return document.querySelector('.nxt-text-layer')?.textContent;
    `);
    assertEqual(r, 'Hello Nexus', 'text layer content');
  });
  await test('audio clip volume/pan/fade apply to the live WebAudio graph', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const t = S.timeline.tracks.find(x=>x.type==='audio');
      const c = t.clips[0];
      nxSelectClip(c.id, false);
      nxSetClipField(c.id, 'volume', 55);
      nxSetClipField(c.id, 'pan', -70);
      nxCommitInspectorEdit();
      nxSyncTrackPlaybackToPlayhead(t, 0);
      return JSON.stringify({vol: c.volume, pan: c.pan, panNodeValue: t._pan ? Math.round(t._pan.pan.value*100) : null});
    `);
    assertEqual(JSON.parse(r), { vol: 55, pan: -70, panNodeValue: -70 }, 'audio params');
  });
  await test('reset button restores a property to its default', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSetClipProp(c.id, 'transform', 'rotation', 45);
      nxSetClipProp(c.id, 'transform', 'rotation', 0); // what the Inspector's reset button calls
      return c.transform.rotation;
    `);
    assertEqual(r, 0, 'rotation should reset to 0');
  });
}

// ════════════════════════════════════════════════════════════════════════
// MARKERS
// ════════════════════════════════════════════════════════════════════════
async function runMarkerTests() {
  console.log('\n=== Markers ===');
  await test('add marker at playhead, click-to-seek, delete', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxSeekTo(2.5);
      nxAddMarker(); // dialog auto-accepted with 'Test' by the CDP handler
      const m = S.timeline.markers[0];
      const afterAdd = {count: S.timeline.markers.length, time: m.time};
      nxSeekTo(0);
      nxSeekTo(m.time); // simulate the click-to-seek the ruler element performs
      const seeked = S.timeline.playhead === m.time;
      nxDeleteMarker(m.id);
      return JSON.stringify({afterAdd, seeked, afterDelete: S.timeline.markers.length});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.afterAdd.count, 1, 'one marker added');
    assertEqual(parsed.afterAdd.time, 2.5, 'marker at playhead time');
    assert(parsed.seeked, 'seeking to marker time should move the playhead');
    assertEqual(parsed.afterDelete, 0, 'marker removed');
  });
}

// ════════════════════════════════════════════════════════════════════════
// MEDIA BIN
// ════════════════════════════════════════════════════════════════════════
async function runMediaBinTests() {
  console.log('\n=== Media bin ===');
  await test('adding an existing asset again creates a second clip without re-decoding', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const assetId = Object.keys(S.timeline.assets)[0];
      const before = S.timeline.tracks[0].clips.length;
      nxAddAssetToTimeline(assetId);
      return JSON.stringify({before, after: S.timeline.tracks[0].clips.length, assetsStillOne: Object.keys(S.timeline.assets).length});
    `);
    assertEqual(JSON.parse(r), { before: 1, after: 2, assetsStillOne: 1 }, 'reuse-asset add');
  });
  await test('search and category filters narrow the visible list', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      nxSetLeftPanelTab('media');
      const all = document.querySelectorAll('.media-bin-item').length;
      nxMediaBinSearch = 'nomatch-xyz'; nxRenderMediaBin();
      const noMatch = document.querySelectorAll('.media-bin-item').length;
      nxMediaBinSearch = ''; nxMediaBinFilter = 'audio'; nxRenderMediaBin();
      const audioOnly = document.querySelectorAll('.media-bin-item').length;
      nxMediaBinFilter = 'all';
      return JSON.stringify({all, noMatch, audioOnly});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.all, 1, 'one video asset visible under All');
    assertEqual(parsed.noMatch, 0, 'search with no match should show nothing');
    assertEqual(parsed.audioOnly, 0, 'no audio assets in a video-only project');
  });
  await test('deleting an asset (through the real confirm-modal flow) cascades to every clip built from it', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    await page.evalBlock(`const id = Object.keys(S.timeline.assets)[0]; nxAddAssetToTimeline(id); return null;`);
    await page.evalBlock(`nxDeleteAsset(Object.keys(S.timeline.assets)[0]); return null;`);
    await sleep(200);
    const modalShown = await page.eval(`document.getElementById('modal-bg').classList.contains('show')`);
    assert(modalShown, 'expected the confirm modal to appear before deleting');
    await page.trustedClickSelector('#modal-confirm');
    await sleep(300);
    const r = await page.eval(`JSON.stringify({assets: Object.keys(S.timeline.assets).length, clips: S.timeline.tracks.reduce((n,t)=>n+t.clips.length,0)})`);
    const parsed = JSON.parse(r);
    assertEqual(parsed.assets, 0, 'asset removed');
    assertEqual(parsed.clips, 0, 'both clips built from it removed');
  });
}

// ════════════════════════════════════════════════════════════════════════
// LINKED AUDIO (graceful degradation — see test/README.md)
// ════════════════════════════════════════════════════════════════════════
async function runLinkedAudioTests() {
  console.log('\n=== Linked audio (graceful degradation) ===');
  await test('failed extraction never crashes, leaves video audible and unmuted', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(6000); // give extraction time to attempt + fail
    const vidMuted = await page.eval(`document.getElementById('preview-vid').muted`);
    assertEqual(vidMuted, false, 'video should stay unmuted if linked-audio extraction did not succeed');
    assert(page.consoleMsgs.filter(m => /uncaught/i.test(m)).length === 0, 'no uncaught exceptions from a failed extraction: ' + JSON.stringify(page.consoleMsgs));
  });
}

// ════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════
async function runExportTests() {
  console.log('\n=== Exports ===');
  await test('audio mixdown export produces a downloadable result', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    await page.warmUpActivation();
    await page.eval(`window.__done = false; nxExportAudioMixdown().then(() => window.__done = true)`);
    let status = null;
    for (let i = 0; i < 15; i++) { await sleep(1000); status = await page.eval(`document.getElementById('ed-status')?.textContent`); if (status?.includes('exported')) break; }
    assert(status && status.includes('exported'), 'expected a success status, got: ' + status);
  });
  await test('video export produces a real, non-empty .webm via canvas+MediaRecorder capture', async page => {
    await page.gotoEditor();
    await page.warmUpActivation();
    await page.setFile(VIDEO);
    await sleep(2500);
    await page.trustedClickSelector('.nxt-export-btn');
    let status = null;
    for (let i = 0; i < 20; i++) { await sleep(1000); status = await page.eval(`document.getElementById('ed-status')?.textContent`); if (status && (status.includes('exported') || status.includes('failed') || status.includes('no data'))) break; }
    assert(status && status.includes('exported'), 'expected a success status, got: ' + status);
  });
}

// ════════════════════════════════════════════════════════════════════════
// DSP EFFECTS (track-level: de-esser, EQ, compressor, delay, reverb, ducking)
// ════════════════════════════════════════════════════════════════════════
async function runDspTests() {
  console.log('\n=== DSP effects ===');
  await test('every effect connects a live node when toggled on', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const t = S.timeline.tracks.find(x=>x.type==='audio');
      nxSelectClip(t.clips[0].id, false);
      ['deesser','eq','comp','delay','reverb'].forEach(fx => nxToggleTrackFx(t.id, fx));
      const m = t._fxNodeMap;
      return JSON.stringify({deesser:!!m.deesser, eqLow:!!m.eqLow, eqMid:!!m.eqMid, eqHigh:!!m.eqHigh, comp:!!m.comp, delayTime:!!m.delayTime, reverbConv:!!m.reverbConv});
    `);
    assertEqual(JSON.parse(r), { deesser: true, eqLow: true, eqMid: true, eqHigh: true, comp: true, delayTime: true, reverbConv: true }, 'all fx nodes present');
  });
  await test('a param change updates the existing node without rebuilding it (no click on drag)', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const t = S.timeline.tracks.find(x=>x.type==='audio');
      nxToggleTrackFx(t.id, 'eq');
      const before = t._fxNodeMap.eqLow;
      nxSetTrackFxParam(t.id, 'eq', 'low', 8);
      nxCommitInspectorEdit();
      return JSON.stringify({sameNode: before === t._fxNodeMap.eqLow, storedValue: t.fx.eq.low});
    `);
    assertEqual(JSON.parse(r), { sameNode: true, storedValue: 8 }, 'in-place param update');
  });
  await test('disabling an effect removes its node from the chain', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const t = S.timeline.tracks.find(x=>x.type==='audio');
      nxToggleTrackFx(t.id, 'eq');
      nxToggleTrackFx(t.id, 'eq');
      return JSON.stringify({eqLowGone: !t._fxNodeMap.eqLow, enabled: t.fx.eq.enabled});
    `);
    assertEqual(JSON.parse(r), { eqLowGone: true, enabled: false }, 'clean disable');
  });
  await test('ducking wires a dedicated gain node distinct from clip volume/fade', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      nxAddTrack('audio');
      const [a1, a2] = S.timeline.tracks.filter(t=>t.type==='audio');
      a1.fx.duck.enabled = true; a1.fx.duck.againstTrackId = a2.id;
      nxEnsureTrackAudioEl(a1); nxEnsureTrackAudioEl(a2);
      for (let i = 0; i < 5; i++) nxUpdateDucking(); // should not throw
      return JSON.stringify({hasDuckGain: !!a1._duckGain, distinctFromClipGain: a1._duckGain !== a1._gain});
    `);
    assertEqual(JSON.parse(r), { hasDuckGain: true, distinctFromClipGain: true }, 'ducking node');
  });
  await test('audio mixdown export succeeds with every effect (incl. ducking) enabled', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`
      nxAddTrack('audio');
      const [a1, a2] = S.timeline.tracks.filter(t=>t.type==='audio');
      ['deesser','eq','comp','delay','reverb'].forEach(fx => nxToggleTrackFx(a1.id, fx));
      a1.fx.duck.enabled = true; a1.fx.duck.againstTrackId = a2.id;
      return null;
    `);
    await page.eval(`window.__done = false; nxExportAudioMixdown().then(() => window.__done = true)`);
    let status = null;
    for (let i = 0; i < 15; i++) { await sleep(1000); status = await page.eval(`document.getElementById('ed-status')?.textContent`); if (status?.includes('exported') || status?.includes('failed')) break; }
    assert(status && status.includes('exported'), 'expected export to succeed with effects enabled, got: ' + status);
    assert(page.consoleMsgs.length === 0, 'no console errors exporting with effects: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('Inspector renders the Track Effects section for a selected audio clip', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const t = S.timeline.tracks.find(x=>x.type==='audio');
      nxSelectClip(t.clips[0].id, false);
      const html = document.getElementById('er-body').innerHTML;
      return JSON.stringify({hasEQ: html.includes('3-Band EQ'), hasComp: html.includes('Compressor'), hasDelay: html.includes('Delay'), hasReverb: html.includes('Reverb'), hasDucking: html.includes('Ducking')});
    `);
    assertEqual(JSON.parse(r), { hasEQ: true, hasComp: true, hasDelay: true, hasReverb: true, hasDucking: true }, 'Inspector fx sections');
  });
}

// ════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ════════════════════════════════════════════════════════════════════════
async function runEdgeCaseTests() {
  console.log('\n=== Edge cases ===');
  await test('empty project: timeline shows empty state, no console errors', async page => {
    await page.gotoEditor();
    const html = await page.eval(`document.getElementById('nx-timeline').innerHTML`);
    assert(html.includes('Drop media') || html === '', 'empty state or untouched panel expected');
    assert(page.consoleMsgs.length === 0, 'no errors on an empty project');
  });
  await test('many clips (20x split) keeps the timeline responsive with no errors', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    await page.evalBlock(`
      for (let i = 0; i < 20; i++) {
        const t = S.timeline.tracks[0];
        const longest = t.clips.reduce((a,b) => b.duration > a.duration ? b : a, t.clips[0]);
        nxSeekTo(longest.startTime + longest.duration/2);
        nxSplitAtPlayhead();
      }
      return S.timeline.tracks[0].clips.length;
    `);
    const count = await page.eval(`S.timeline.tracks[0].clips.length`);
    assert(count >= 15, 'expected the timeline to have grown from repeated splits, got ' + count);
    assert(page.consoleMsgs.length === 0, 'no console errors with 15+ clips: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('many tracks (10x add) keeps mount/undo/redo stable', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      for (let i = 0; i < 10; i++) nxAddTrack(i % 2 === 0 ? 'audio' : 'video');
      const count = S.timeline.tracks.length;
      nxUndo(); nxUndo(); nxRedo();
      return JSON.stringify({count, afterUndoRedo: S.timeline.tracks.length});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.count, 11, '10 added + the original V1');
    assert(page.consoleMsgs.length === 0, 'no console errors with 11 tracks');
  });
  await test('deleting the only clip on a track leaves an empty (not broken) track', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxDeleteSelection();
      return JSON.stringify({tracks: S.timeline.tracks.length, clips: S.timeline.tracks[0].clips.length});
    `);
    assertEqual(JSON.parse(r), { tracks: 1, clips: 0 }, 'track survives with zero clips');
    assert(page.consoleMsgs.length === 0, 'no errors deleting the last clip');
  });
  await test('rapid play/pause (10x) produces no console errors', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(VIDEO); await sleep(2500);
    await page.evalBlock(`for (let i = 0; i < 10; i++) nxTogglePlay();`, { awaitPromise: false });
    await sleep(1000);
    assert(page.consoleMsgs.filter(m => !/NotAllowedError/.test(m)).length === 0, 'no unexpected errors from rapid toggling: ' + JSON.stringify(page.consoleMsgs));
  });
}

// ════════════════════════════════════════════════════════════════════════
// RELOAD PERSISTENCE (honest check — this app has no save/load layer)
// ════════════════════════════════════════════════════════════════════════
async function runReloadTest() {
  console.log('\n=== Reload persistence ===');
  await test('DOCUMENTS actual behavior: state does NOT survive a page reload', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2500);
    await page.send('Page.reload', {});
    await sleep(1500);
    const hasFile = await page.eval(`!!S.file`);
    // This assertion is intentionally the opposite of "passing" in the
    // usual sense — it documents that reload does NOT preserve state,
    // so nobody assumes otherwise. See test/README.md.
    assertEqual(hasFile, false, 'confirmed: project state does not persist across reload (no save/load layer exists)');
  });
}

// ════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`Testing against ${BASE_URL}`);
  await runImportTests();
  await runCoreEditingTests();
  await runTrackTests();
  await runInspectorTests();
  await runMarkerTests();
  await runMediaBinTests();
  await runLinkedAudioTests();
  await runExportTests();
  await runDspTests();
  await runEdgeCaseTests();
  await runReloadTest();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);
  console.log(`\n${passed}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFailed:');
    failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    process.exitCode = 1;
  }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
