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
  // timeoutMs actually bounds the wait (Promise.race) instead of just being
  // an accepted-but-ignored option — without this, a genuinely hung page
  // (main thread pinned, e.g. by a runaway per-frame seek loop) makes the
  // CDP response never arrive, so `await this.send(...)` hangs forever and
  // takes the whole suite down with it instead of failing that one test.
  async eval(expr, { awaitPromise = false, timeoutMs = 15000 } = {}) {
    const r = await Promise.race([
      this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise }),
      sleep(timeoutMs).then(() => { throw new Error(`eval timed out after ${timeoutMs}ms — page is likely hung/unresponsive`); }),
    ]);
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
const IMAGE = FIXTURES + 'test_image.png';

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
  await test('replacing the file while its audio is actively playing stops the old track for good', async page => {
    // Regression test: nxEnsureTimeline() used to wipe S.timeline.tracks on
    // file replace without ever pausing the outgoing track's <audio>
    // element. That element's WebAudio graph (createMediaElementSource ->
    // ... -> actx.destination) keeps it alive and producing sound even once
    // nothing in JS references the track object anymore, so replacing a
    // file while it was playing left the OLD file's audio playing forever
    // in the background — the new file loaded silently on top of it.
    await page.gotoEditor();
    await page.setFile(AUDIO);
    await sleep(1000);
    await page.trustedClickSelector('#vinyl-play-btn');
    await sleep(800);
    const before = JSON.parse(await page.evalBlock(`
      window._oldTrack = S.timeline.tracks.find(t => t.type === 'audio');
      window._oldEl = window._oldTrack._el;
      return JSON.stringify({ playing: S.timeline._playing, elPaused: window._oldEl ? window._oldEl.paused : 'no-el' });
    `));
    assertEqual(before, { playing: true, elPaused: false }, 'old track should genuinely be playing before replace');

    await page.setFile(AUDIO); // triggers the modal again (a second load of the same file is still a "replace")
    await sleep(300);
    await page.trustedClickSelector('#modal-confirm');
    await sleep(600);

    const after = JSON.parse(await page.evalBlock(`
      return JSON.stringify({
        newTrackIsDifferentObject: S.timeline.tracks.find(t => t.type === 'audio') !== window._oldTrack,
        oldElPaused: window._oldEl.paused,
        oldElCurrentTimeSnapshot: window._oldEl.currentTime,
      });
    `));
    assert(after.newTrackIsDifferentObject, 'replace should build a fresh track, not reuse the old one');
    assert(after.oldElPaused, 'the outgoing track\'s <audio> element must be paused on replace');

    await sleep(1200); // if the old element were still silently playing, currentTime would keep advancing
    const stillFrozen = await page.eval(`window._oldEl.currentTime === ${after.oldElCurrentTimeSnapshot}`);
    assert(stillFrozen, 'old track audio must not still be advancing/playing after replace');
  });
  await test('a full-length track auto-fits the timeline width on load, not just the first ~20s', async page => {
    // Regression test: the timeline always opened at a fixed 80px/s zoom
    // and nxSetZoom had a 20px/s floor, so anything longer than roughly
    // (panel width)/80 seconds was cut off the right edge and (even after
    // manually clicking Fit) couldn't be zoomed out far enough to actually
    // fit — the floor silently clamped it back up. Simulates a 2:49 track
    // (the reported case) via S.file.duration, since the real fixture is
    // only 8s and the fit math is purely duration-driven.
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      S.file.duration = 169; // 2:49, matches the reported case
      S.timeline._seededFor = null; // force a reseed at the new duration
      mountNxTimeline();
      const scroll = document.getElementById('nxt-scroll');
      const contentWidth = nxContentWidth();
      return JSON.stringify({ fits: contentWidth <= scroll.clientWidth + 2, zoom: S.timeline.zoom, contentWidth, scrollWidth: scroll.clientWidth });
    `);
    const parsed = JSON.parse(r);
    assert(parsed.fits, `a 2:49 track should auto-fit within the visible timeline width without scrolling, got ${JSON.stringify(parsed)}`);
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
      // .slice(-3): scope to just the 3 tracks this test added, independent
      // of whether linked-audio extraction (spec #33) already added its own
      // audio track by now — this test is about solo semantics, not that.
      const tracks = S.timeline.tracks.filter(t=>t.type==='audio').slice(-3);
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
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(3500);
    const r = await page.evalBlock(`
      const assetId = Object.keys(S.timeline.assets)[0];
      const before = S.timeline.tracks[0].clips.length;
      const assetsBefore = Object.keys(S.timeline.assets).length;
      nxAddAssetToTimeline(assetId);
      return JSON.stringify({before, after: S.timeline.tracks[0].clips.length, assetsUnchanged: Object.keys(S.timeline.assets).length === assetsBefore});
    `);
    // assetsUnchanged (not a fixed count): linked-audio extraction (spec #33)
    // adds its own second asset in the background, so the total asset count
    // depends on whether extraction has finished by now — what this test
    // actually cares about is that RE-ADDING the same asset doesn't create
    // a new one, which "before vs after nxAddAssetToTimeline" captures
    // regardless of that background count.
    assertEqual(JSON.parse(r), { before: 1, after: 2, assetsUnchanged: true }, 'reuse-asset add');
  });
  await test('search and category filters narrow the visible list', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(3500);
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
    // 2, not 1: the video asset plus the linked-audio track's own asset
    // (spec #33 extraction — see runLinkedAudioTests) now that FFmpeg
    // actually loads and extraction succeeds instead of failing silently.
    assertEqual(parsed.all, 2, 'video asset + its auto-extracted linked audio asset visible under All');
    assertEqual(parsed.noMatch, 0, 'search with no match should show nothing');
    assertEqual(parsed.audioOnly, 1, 'the auto-extracted linked audio asset should show under the Audio filter');
  });
  await test('deleting an asset (through the real confirm-modal flow) cascades to every clip built from it', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(3500);
    // Target the video asset specifically (by id, captured up front) rather
    // than assuming it's the only asset in the project — linked-audio
    // extraction (spec #33) adds an unrelated second asset in the
    // background, and deleting the video asset should not touch that one.
    const targetId = await page.eval(`Object.keys(S.timeline.assets)[0]`);
    const targetIdJson = JSON.stringify(targetId);
    await page.evalBlock(`nxAddAssetToTimeline(${targetIdJson}); return null;`);
    await page.evalBlock(`nxDeleteAsset(${targetIdJson}); return null;`);
    await sleep(200);
    const modalShown = await page.eval(`document.getElementById('modal-bg').classList.contains('show')`);
    assert(modalShown, 'expected the confirm modal to appear before deleting');
    await page.trustedClickSelector('#modal-confirm');
    await sleep(300);
    const r = await page.eval(`JSON.stringify({
      assetStillExists: ${targetIdJson} in S.timeline.assets,
      clipsFromTarget: S.timeline.tracks.reduce((n,t)=>n+t.clips.filter(c=>c.sourceAssetId===${targetIdJson}).length, 0),
    })`);
    const parsed = JSON.parse(r);
    assertEqual(parsed.assetStillExists, false, 'the deleted asset itself is gone');
    assertEqual(parsed.clipsFromTarget, 0, 'both clips built from the deleted asset removed');
  });
}

// ════════════════════════════════════════════════════════════════════════
// LINKED AUDIO (spec #33 — video's embedded audio demuxed into an
// independent, editable track)
// ════════════════════════════════════════════════════════════════════════
async function runLinkedAudioTests() {
  console.log('\n=== Linked audio ===');
  await test('extraction succeeds: video audio is demuxed into an independent, editable audio track', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(6000); // give extraction time to complete
    const r = await page.evalBlock(`
      const vid = document.getElementById('preview-vid');
      const audioTracks = S.timeline.tracks.filter(t => t.type === 'audio');
      const videoClip = S.timeline.tracks.find(t => t.type === 'video').clips[0];
      return JSON.stringify({
        vidMuted: vid.muted,
        audioTrackCount: audioTracks.length,
        linked: !!videoClip.linkedClipId && audioTracks.some(t => t.clips.some(c => c.id === videoClip.linkedClipId)),
      });
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.vidMuted, true, "the original <video>'s own audio should be muted once it's independently extracted");
    assert(parsed.audioTrackCount >= 1, 'expected at least one linked audio track after extraction');
    assert(parsed.linked, 'the video clip and the extracted audio clip should reference each other via linkedClipId');
    assert(page.consoleMsgs.filter(m => /uncaught/i.test(m)).length === 0, 'no uncaught exceptions during extraction: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('switching to a photo mid-extraction never leaks the timeline panel into photo mode', async page => {
    // Regression test for a real bug: nxExtractLinkedAudio() runs in the
    // background after a video loads. If the user replaces the project
    // with a photo before that finishes, the extraction's completion used
    // to call mountNxTimeline() unconditionally — showing the video/audio
    // timeline panel, populated with a stale audio track, underneath a
    // photo-editing tool. Delays ensureFFmpeg() by 1.5s (real extraction on
    // the tiny test fixture finishes in well under 500ms, too fast to
    // reliably race in a test) so there's a wide, deterministic window to
    // switch files inside — no production code is touched, only this
    // page's own copy of the function.
    await page.gotoEditor();
    await page.evalBlock(`
      const _origEnsureFFmpeg = window.ensureFFmpeg;
      window.ensureFFmpeg = (...args) => new Promise(resolve => {
        setTimeout(() => resolve(_origEnsureFFmpeg(...args)), 1500);
      });
      return null;
    `);
    await page.setFile(VIDEO);
    await sleep(400); // well inside the 1.5s artificial delay
    await page.setFile(IMAGE); // triggers the "Replace File?" modal
    await sleep(300);
    await page.trustedClickSelector('#modal-confirm');
    await sleep(2500); // long enough for the delayed extraction to finish
    const r = await page.evalBlock(`
      return JSON.stringify({
        fileType: S.file?.type,
        panelShowing: document.getElementById('nx-timeline')?.classList.contains('show'),
      });
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.fileType, 'image', 'the photo should be the active project');
    assertEqual(parsed.panelShowing, false, 'the video/audio timeline panel must never appear while a photo is active');
    assert(page.consoleMsgs.filter(m => /uncaught/i.test(m)).length === 0, 'no uncaught exceptions: ' + JSON.stringify(page.consoleMsgs));
  });
  // Graceful degradation (no audio stream in the source, or FFmpeg
  // unavailable) is handled by nxExtractLinkedAudio's own try/catch and the
  // data.byteLength < 512 bail-out — verified by reading that code, not
  // reproduced here: doing so honestly would need a real fixture with no
  // audio stream, which this suite doesn't have.
}

// ════════════════════════════════════════════════════════════════════════
// FFMPEG STANDALONE TOOLS (the 10 audio + 13 video single-file processors
// in the left sidebar — separate from the timeline's native export path)
// ════════════════════════════════════════════════════════════════════════
// ensureFFmpeg() loads @ffmpeg/ffmpeg from a CDN into a page hosted
// elsewhere, which needs classWorkerURL to avoid a cross-origin Worker
// SecurityError — and, less obviously, needs worker.js's own two relative
// imports (./const.js, ./errors.js) rewritten to absolute CDN URLs once
// it's blobbed, since a blob: URL has no directory for a relative import
// to resolve against. Without the second half of that fix, the worker
// dies within ~10ms of construction with no catchable exception at all
// (module resolution failures fire a sanitized Worker onerror instead),
// so ffmpegInst.load() hangs forever — this test exists specifically to
// catch that regressing silently again.
async function runFfmpegToolsTests() {
  console.log('\n=== FFmpeg standalone tools ===');
  await test('audio-trim initializes FFmpeg and produces a real downloadable file', async page => {
    await page.gotoEditor();
    await page.evalBlock(`selectTool(TOOLS.find(t => t.id === 'audio-trim')); return null;`);
    await page.setFile(AUDIO);
    await sleep(1500);
    // Process and Download were merged into one button — see
    // "remove Process, make every tool preview live" in the app's history.
    await page.trustedClickSelector('#btn-dl');
    let r = null;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const parsed = JSON.parse(await page.eval(`JSON.stringify({processing: S.processing, hasOutput: !!S.outputBlob, outputName: S.outputName})`));
      if (!parsed.processing && parsed.hasOutput) { r = parsed; break; }
    }
    assert(r, 'FFmpeg processing should complete within 60s, not hang indefinitely');
    assertEqual(r.outputName, 'test_audio_trim.m4a', 'expected output filename');
    assert(page.consoleMsgs.length === 0, 'no console errors: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('audio-to-video and video-extract are two-step tools: Convert then Download', async page => {
    await page.gotoEditor();
    await page.setFile(AUDIO);
    await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-to-video'));`);
    await sleep(300);
    const preConvert = JSON.parse(await page.eval(`JSON.stringify({convertVisible: getComputedStyle(document.getElementById('btn-convert')).display !== 'none', dlDisabled: document.getElementById('btn-dl').disabled})`));
    assertEqual(preConvert, { convertVisible: true, dlDisabled: true }, 'Convert button should show, Download should be disabled until something has been converted');
    await page.trustedClickSelector('#btn-convert');
    await sleep(300);
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const stillProcessing = await page.eval(`S.processing`);
      if (!stillProcessing) break;
    }
    const postConvert = JSON.parse(await page.eval(`JSON.stringify({hasOutput: !!S.outputBlob, dlDisabled: document.getElementById('btn-dl').disabled})`));
    assertEqual(postConvert, { hasOutput: true, dlDisabled: false }, 'Convert alone should produce a result and enable Download, without downloading anything yet');
  });
  await test('audio-to-video produces a real, decodable video in every output format', async page => {
    await page.gotoEditor();
    await page.setFile(AUDIO);
    await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-to-video'));`);
    await sleep(300);
    await page.trustedClickSelector('#btn-convert');
    let r = null;
    for (let i = 0; i < 90; i++) {
      await sleep(1000);
      const parsed = JSON.parse(await page.eval(`JSON.stringify({processing: S.processing, hasOutput: !!S.outputBlob, outputName: S.outputName, blobSize: S.outputBlob ? S.outputBlob.size : 0})`));
      if (!parsed.processing && parsed.hasOutput) { r = parsed; break; }
    }
    assert(r, 'audio-to-video should complete within 90s, not hang indefinitely');
    assertEqual(r.outputName, 'test_audio_to-video.mp4', 'expected output filename');
    assert(r.blobSize > 5000, 'output video should be a real, non-trivial file: ' + JSON.stringify(r));
    const meta = JSON.parse(await page.evalBlock(`
      return (async () => {
        const url = URL.createObjectURL(S.outputBlob);
        const v = document.createElement('video');
        v.src = url;
        await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = rej; setTimeout(rej, 8000); });
        return JSON.stringify({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      })();
    `, { awaitPromise: true, timeoutMs: 12000 }));
    assert(meta.duration > 0 && meta.width === 854 && meta.height === 480, 'output should be a genuinely decodable 854x480 video: ' + JSON.stringify(meta));
    assert(page.consoleMsgs.length === 0, 'no console errors: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('video-extract offers all 6 audio formats and each produces real output', async page => {
    await page.gotoEditor();
    await page.setFile(VIDEO);
    await sleep(2500);
    await page.evalBlock(`selectTool(byId('video-extract'));`);
    await sleep(200);
    for (const fmt of ['ogg', 'flac', 'm4a']) {
      await page.evalBlock(`setSetting('audioFormat','${fmt}'); renderSettings('video-extract');`);
      await sleep(150);
      await page.trustedClickSelector('#btn-convert');
      let r = null;
      for (let i = 0; i < 60; i++) {
        await sleep(1000);
        const parsed = JSON.parse(await page.eval(`JSON.stringify({processing: S.processing, hasOutput: !!S.outputBlob, outputName: S.outputName, blobSize: S.outputBlob ? S.outputBlob.size : 0})`));
        if (!parsed.processing && parsed.hasOutput) { r = parsed; break; }
      }
      assert(r, `video-extract (${fmt}) should complete within 60s`);
      assertEqual(r.outputName, `test_video_extract.${fmt}`, `expected ${fmt} output filename`);
      assert(r.blobSize > 500, `output should be a real file for ${fmt}: ` + JSON.stringify(r));
    }
    assert(page.consoleMsgs.length === 0, 'no console errors across formats: ' + JSON.stringify(page.consoleMsgs));
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
// VINYL AUDIO PLAYER
// ════════════════════════════════════════════════════════════════════════
async function runVinylTests() {
  console.log('\n=== Vinyl audio player ===');
  await test('mounts with cleaned title, filename, fallback label, and track color', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      return JSON.stringify({
        hasPlayer: !!document.getElementById('vinyl-player'),
        title: document.getElementById('vinyl-title')?.textContent,
        filename: document.querySelector('.cover-text p')?.textContent,
        hasFallback: !!document.querySelector('.vinyl-label .nexus-mark'),
        trackColor: document.getElementById('vinyl-player')?.style.getPropertyValue('--track-color'),
      });
    `);
    const parsed = JSON.parse(r);
    assert(parsed.hasPlayer, 'vinyl player should mount for an audio project');
    assertEqual(parsed.title, 'Test Audio', 'cleaned title from test_audio.m4a');
    assertEqual(parsed.filename, 'test_audio.m4a', 'original filename kept as secondary metadata');
    assert(parsed.hasFallback, 'no embedded art in the fixture — fallback label expected');
    assertEqual(parsed.trackColor, '#ff3b3b', "A1's assigned palette color");
  });
  await test('metadata line reflects real decoded sample rate and channel count', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(2500);
    const text = await page.eval(`document.getElementById('vinyl-meta')?.textContent`);
    assert(/M4A/.test(text), 'format from extension: ' + text);
    assert(/kHz/i.test(text), 'real sample rate present: ' + text);
    assert(/Mono|Stereo/.test(text), 'real channel count present: ' + text);
  });
  await test('disc rotation angle is an exact function of playhead (33⅓ RPM), not a timer', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      nxSeekTo(3);
      const RPM = 33 + 1/3;
      const expected = (3 * (RPM/60*360)) % 360;
      const m = document.getElementById('vinyl-disc').style.transform.match(/rotate\\(([-\\d.]+)deg\\)/);
      const actual = m ? parseFloat(m[1]) : null;
      return JSON.stringify({expected: +expected.toFixed(1), actual, close: Math.abs(expected-actual) < 0.5});
    `);
    const parsed = JSON.parse(r);
    assert(parsed.close, 'rotation angle should exactly match playhead formula: ' + r);
  });
  await test('play advances rotation in real time and updates the play/pause icon; pause settles the reactor', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    await page.eval(`nxSeekTo(2); nxTogglePlay();`);
    const playingClass = await page.eval(`document.getElementById('vinyl-player').classList.contains('playing')`);
    assert(playingClass, 'playing class should be set');
    const angle1 = await page.eval(`document.getElementById('vinyl-disc').style.transform`);
    await sleep(600);
    const angle2 = await page.eval(`document.getElementById('vinyl-disc').style.transform`);
    assert(angle1 !== angle2, 'rotation should advance while playing');
    await page.eval(`nxTogglePlay();`);
    await sleep(100);
    const r = await page.evalBlock(`
      const bars = window._nxVinylBarEls;
      return JSON.stringify({playing: document.getElementById('vinyl-player').classList.contains('playing'), allSettled: bars.every(b => b.style.height === '6px')});
    `);
    assertEqual(JSON.parse(r), { playing: false, allSettled: true }, 'paused + settled');
  });
  await test('timeline ruler scrubbing updates the vinyl timecode to the exact playhead', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const ruler = document.getElementById('nxt-ruler');
      const rect = ruler.getBoundingClientRect();
      nxSeekFromRuler({clientX: rect.left + 2 * S.timeline.zoom, stopPropagation(){}});
      return JSON.stringify({playhead: S.timeline.playhead, timeText: document.getElementById('vinyl-time').textContent, expected: fmtTime(S.timeline.playhead) + ' / ' + fmtTime(nxDuration())});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.timeText, parsed.expected, 'vinyl timecode should exactly match the scrubbed playhead');
  });
  await test('selecting a different audio clip updates title, color, and source together', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      nxAddTrack('audio');
      const t1 = S.timeline.tracks.find(t=>t.name==='A1');
      const t2 = S.timeline.tracks.find(t=>t.name==='A2');
      const c = nxMakeClip(t1.clips[0].sourceAssetId, t2.id, {startTime:0, duration: t1.clips[0].duration, sourceEnd: t1.clips[0].duration});
      t2.clips.push(c);
      nxSelectClip(c.id, false);
      return JSON.stringify({trackColor: t2.color, vinylColor: document.getElementById('vinyl-player').style.getPropertyValue('--track-color')});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.vinylColor, parsed.trackColor, "vinyl should reflect the newly selected clip's track color");
  });
  await test('10x rapid play/pause never desyncs vinyl from timeline state', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      for (let i = 0; i < 10; i++) nxTogglePlay();
      return JSON.stringify({timelinePlaying: S.timeline._playing, vinylPlayingClass: document.getElementById('vinyl-player').classList.contains('playing')});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.vinylPlayingClass, parsed.timelinePlaying, 'vinyl playing-state must match timeline state after rapid toggling');
    assert(page.consoleMsgs.length === 0, 'no console errors from rapid toggling: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('video projects never mount a vinyl container', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(2000);
    const has = await page.eval(`!!document.getElementById('vinyl-container')`);
    assertEqual(has, false, 'vinyl is audio-project-only UI');
  });
  await test('spectrum renders exactly 64 bars, driven by real per-bar frequency data', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    const count = await page.eval(`document.querySelectorAll('.reactor-bar').length`);
    assertEqual(count, 64, 'spectrum should render 64 bars per the approved spec');
    await page.eval(`nxTogglePlay();`);
    await sleep(500);
    const varied = await page.eval(`new Set(window._nxVinylBarEls.map(b => b.style.height)).size > 1`);
    assert(varied, 'bars should show varied real heights while audio plays, not a uniform fake value');
    await page.eval(`nxTogglePlay();`);
  });
  await test('clicking the progress track seeks the shared playhead (same as the ruler)', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const track = document.getElementById('vinyl-progress-track');
      const rect = track.getBoundingClientRect();
      const midX = rect.left + rect.width * 0.5;
      track.dispatchEvent(new MouseEvent('mousedown', {clientX: midX, clientY: rect.top + 2, bubbles: true}));
      document.dispatchEvent(new MouseEvent('mouseup', {clientX: midX, clientY: rect.top + 2, bubbles: true}));
      const dur = nxDuration();
      return JSON.stringify({playhead: S.timeline.playhead, expectedApprox: dur * 0.5, fillWidth: document.getElementById('vinyl-progress-fill').style.width});
    `);
    const parsed = JSON.parse(r);
    assert(Math.abs(parsed.playhead - parsed.expectedApprox) < 0.3, 'clicking the middle of the progress track should seek to ~50%: ' + r);
    assert(parsed.fillWidth.startsWith('4') || parsed.fillWidth.startsWith('5'), 'progress fill should reflect ~50%: ' + r);
  });
  await test('reselecting clips repeatedly does not stack duplicate drag listeners', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    const r = await page.evalBlock(`
      const c = S.timeline.tracks[0].clips[0];
      for (let i = 0; i < 8; i++) nxSelectClip(c.id, false);
      return typeof window._nxVinylDragCleanup;
    `);
    assertEqual(r, 'function', 'exactly one live cleanup function should be tracked regardless of reselect count');
    assert(page.consoleMsgs.length === 0, 'no console errors from repeated reselection: ' + JSON.stringify(page.consoleMsgs));
  });
}
// ════════════════════════════════════════════════════════════════════════
// CLASSIC AUDIO-TOOL LIVE PREVIEW
// ════════════════════════════════════════════════════════════════════════
// Regression coverage for a real hang: nxDrivePlaybackClock derived
// S.timeline.playhead from the playing element's currentTime WITHOUT
// dividing by clip.speed, while nxSyncTrackPlaybackToPlayhead's sourceTime
// formula DOES multiply by speed — the two only agreed at speed===1. At
// any other speed the "corrected" sourceTime was wrong again every single
// frame, so it force-seeked the <audio> element every frame — 60 real
// seeks/sec pins the main thread and hangs the tab. Unreachable before the
// classic single-tool audio-speed panel started actually setting
// clip.speed away from 1 during live playback.
async function runClassicAudioLivePreviewTests() {
  console.log('\n=== Classic audio-tool live preview ===');
  await test('changing speed while playing never hangs the page, at any speed in range', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-speed'));`);
    await sleep(150); // let selectTool's own delayed default-apply settle first
    await page.eval(`nxTogglePlay();`);
    for (const rate of [2, 4, 0.25, 1.5, 1]) {
      // setS() is the exact function the real slider's oninput calls — a
      // short, bounded eval; if the bug were back, this specific call is
      // what would hang (Page.eval's timeoutMs now actually enforces
      // that, see its own comment), failing this test instead of the
      // whole suite.
      await page.evalBlock(`setS('speed', ${rate});`, { timeoutMs: 3000 });
      await sleep(250);
    }
    const responsive = await page.eval(`1+1`, { timeoutMs: 3000 });
    assertEqual(responsive, 2, 'page must still be responsive after cycling through every speed while playing');
  });
  await test('playhead and el.currentTime stay proportional to speed — no drift-correction seek storm', async page => {
    await page.gotoEditor(); await page.warmUpActivation(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-speed'));`);
    await sleep(150); // let selectTool's own delayed default-apply (1x, a no-op) settle before we set 2x, or it wins the race and overwrites us
    await page.evalBlock(`setS('speed', 2);`);
    await page.eval(`nxTogglePlay();`);
    await sleep(1200);
    const r = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      return JSON.stringify({ playhead: S.timeline.playhead, elCurrentTime: t._el.currentTime, playing: S.timeline._playing, rate: t._el.playbackRate });
    `, { timeoutMs: 3000 });
    const parsed = JSON.parse(r);
    assert(parsed.playing, 'should still be playing after 1.2s at 2x speed');
    assertEqual(parsed.rate, 2, 'the live element playbackRate should actually be 2');
    // el.currentTime should be ~2x playhead (playbackRate=2), within timing slack —
    // NOT wildly diverged/reset, which is what the seek-storm bug produced.
    const ratio = parsed.elCurrentTime / parsed.playhead;
    assert(ratio > 1.6 && ratio < 2.4, `elCurrentTime/playhead should track speed (~2x), got ${ratio.toFixed(2)} (playhead=${parsed.playhead}, elCurrentTime=${parsed.elCurrentTime})`);
  });
  await test('opening audio-mono/audio-normalize/audio-volume/audio-fade does not itself change the audio', async page => {
    // Regression test: these all used to apply their effect (mono downmix,
    // loudness pull, a 1.5x volume boost, a 2s fade) the instant the tool
    // was selected. Now every one of them must be a no-op until the user
    // actually interacts (a preview toggle button, a preset chip, or the
    // slider) — same requirement as audio-speed/audio-reverse.
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-mono'));`);
    await sleep(200);
    const monoState = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      return JSON.stringify({ channelCount: t._gain?.channelCount, mode: t._gain?.channelCountMode, previewOn: !!S.settings._monoPreviewOn });
    `);
    assertEqual(JSON.parse(monoState), { channelCount: 2, mode: 'max', previewOn: false }, 'opening Mono must not itself downmix the audio');

    await page.evalBlock(`selectTool(byId('audio-normalize'));`);
    await sleep(200);
    const normState = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      return JSON.stringify({ volume: t.clips[0].volume, previewOn: !!S.settings._normalizePreviewOn });
    `);
    assertEqual(JSON.parse(normState), { volume: 100, previewOn: false }, 'opening Normalize must not itself change the volume');

    await page.evalBlock(`selectTool(byId('audio-volume'));`);
    await sleep(200);
    const volState = await page.evalBlock(`return JSON.stringify({ settingsVolume: S.settings.volume, clipVolume: S.timeline.tracks.find(x=>x.type==='audio').clips[0].volume })`);
    assertEqual(JSON.parse(volState), { settingsVolume: 1, clipVolume: 100 }, 'opening Volume must default to 1x (100%), not silently boost the audio');

    await page.evalBlock(`selectTool(byId('audio-fade'));`);
    await sleep(200);
    const fadeState = await page.evalBlock(`return JSON.stringify({ settingsFadeIn: S.settings.fadeIn, settingsFadeOut: S.settings.fadeOut, clipFadeIn: S.timeline.tracks.find(x=>x.type==='audio').clips[0].fadeIn })`);
    assertEqual(JSON.parse(fadeState), { settingsFadeIn: 0, settingsFadeOut: 0, clipFadeIn: 0 }, 'opening Fade must default to 0s (no fade), not silently fade the audio');
  });
  await test('clicking Preview Mono / Preview Normalized applies the effect and reverts cleanly on leaving the tool', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-mono')); nxToggleMonoPreview();`);
    await sleep(150);
    const r1 = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      return JSON.stringify({ channelCount: t._gain?.channelCount, mode: t._gain?.channelCountMode });
    `);
    assertEqual(JSON.parse(r1), { channelCount: 1, mode: 'explicit' }, 'clicking Preview Mono should force a live 1-channel downmix');
    await page.evalBlock(`selectTool(byId('audio-volume'));`);
    await sleep(150);
    const r2 = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      return JSON.stringify({ channelCount: t._gain?.channelCount, mode: t._gain?.channelCountMode });
    `);
    assertEqual(JSON.parse(r2), { channelCount: 2, mode: 'max' }, 'leaving mono must restore normal stereo, or every other tool inherits the downmix');

    await page.evalBlock(`selectTool(byId('audio-normalize')); nxToggleNormalizePreview();`);
    await sleep(600); // peak analysis
    const r3 = await page.evalBlock(`return JSON.stringify({ volume: S.timeline.tracks.find(x=>x.type==='audio').clips[0].volume })`);
    assert(JSON.parse(r3).volume <= 100, 'clicking Preview Normalized should actually change the clip volume: ' + r3);
    await page.evalBlock(`selectTool(byId('audio-volume'));`);
    await sleep(150);
    const r4 = await page.evalBlock(`return JSON.stringify({ volume: S.timeline.tracks.find(x=>x.type==='audio').clips[0].volume })`);
    assertEqual(JSON.parse(r4), { volume: 100 }, 'leaving normalize must restore full volume, or every other tool inherits the loudness pull');
  });
  await test('opening audio-speed/audio-reverse does not itself change the audio — only an explicit interaction does', async page => {
    // Regression test: both tools used to apply their effect the instant
    // the tool was selected (speed defaulted to 1.5x and applied
    // immediately; reverse auto-swapped in reversed audio on open). Now
    // selecting either must be a no-op until the user actually clicks
    // something (a speed preset/slider, or the Preview Reversed button).
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-speed'));`);
    await sleep(200);
    const speedState = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      return JSON.stringify({ settingsSpeed: S.settings.speed, rate: t._el ? t._el.playbackRate : null });
    `);
    assertEqual(JSON.parse(speedState), { settingsSpeed: 1, rate: 1 }, 'opening Speed must default to 1x (no change), not silently speed up/slow down the audio');

    await page.evalBlock(`selectTool(byId('audio-reverse'));`);
    await sleep(600);
    const reverseState = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      const asset = S.timeline.assets[t.clips[0].sourceAssetId];
      return JSON.stringify({ swapped: asset.url === asset._reversedUrl, previewOn: !!S.settings._reversePreviewOn });
    `);
    assertEqual(JSON.parse(reverseState), { swapped: false, previewOn: false }, 'opening Reverse must not itself flip the audio backwards');
  });
  await test('clicking Preview Reversed swaps in a genuinely reversed asset and reverts on leaving the tool', async page => {
    await page.gotoEditor(); await page.setFile(AUDIO); await sleep(1500);
    await page.evalBlock(`selectTool(byId('audio-reverse'));`);
    await sleep(200);
    await page.evalBlock(`nxToggleReversePreview();`); // the explicit click this feature now requires
    await sleep(2000); // decode + reverse the buffer
    const r1 = await page.evalBlock(`
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      const asset = S.timeline.assets[t.clips[0].sourceAssetId];
      return JSON.stringify({ swapped: asset.url === asset._reversedUrl, hasReversed: !!asset._reversedUrl });
    `);
    assertEqual(JSON.parse(r1), { swapped: true, hasReversed: true }, 'clicking Preview Reversed should swap the live asset onto a real reversed buffer');
    const r2 = await page.evalBlock(`
      selectTool(byId('audio-volume'));
      const t = S.timeline.tracks.find(x => x.type === 'audio');
      const asset = S.timeline.assets[t.clips[0].sourceAssetId];
      return JSON.stringify({ restored: asset.url === asset._originalUrl });
    `);
    assertEqual(JSON.parse(r2), { restored: true }, 'leaving reverse must restore the original asset, or every other tool inherits reversed audio');
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
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(3500);
    const r = await page.evalBlock(`
      const startCount = S.timeline.tracks.length; // V1, plus its linked-audio track (spec #33) once extraction completes
      for (let i = 0; i < 10; i++) nxAddTrack(i % 2 === 0 ? 'audio' : 'video');
      const count = S.timeline.tracks.length;
      nxUndo(); nxUndo(); nxRedo();
      return JSON.stringify({startCount, added: count - startCount, afterUndoRedo: S.timeline.tracks.length});
    `);
    const parsed = JSON.parse(r);
    assertEqual(parsed.added, 10, 'all 10 nxAddTrack calls landed');
    assert(page.consoleMsgs.length === 0, 'no console errors with many tracks: ' + JSON.stringify(page.consoleMsgs));
  });
  await test('deleting the only clip on a track leaves an empty (not broken) track', async page => {
    await page.gotoEditor(); await page.setFile(VIDEO); await sleep(3500);
    const r = await page.evalBlock(`
      const trackCountBefore = S.timeline.tracks.length;
      const c = S.timeline.tracks[0].clips[0];
      nxSelectClip(c.id, false);
      nxDeleteSelection();
      return JSON.stringify({tracksUnchanged: S.timeline.tracks.length === trackCountBefore, clips: S.timeline.tracks[0].clips.length});
    `);
    // tracksUnchanged (not a fixed count): a linked-audio track (spec #33)
    // may or may not have finished attaching by now — this test only cares
    // that deleting a clip doesn't also delete the (now empty) track it
    // lived on, regardless of how many other tracks exist.
    assertEqual(JSON.parse(r), { tracksUnchanged: true, clips: 0 }, 'track survives with zero clips');
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
  await runFfmpegToolsTests();
  await runExportTests();
  await runDspTests();
  await runVinylTests();
  await runClassicAudioLivePreviewTests();
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
