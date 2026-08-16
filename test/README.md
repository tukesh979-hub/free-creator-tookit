# Nexus Creator — timeline regression tests

Drives real Chrome via the DevTools Protocol to exercise the unified
timeline end-to-end: import, trim/split/move/duplicate/delete/ripple,
multi-select, track controls (mute/solo/lock/reorder), the Inspector
(transform/speed/text/audio params), markers, the media bin, linked
audio, both export paths, and a set of edge cases. No npm dependencies —
plain Node (v18+, needs built-in `fetch`/`WebSocket`).

## Running

```sh
# 1. Serve the app with the headers FFmpeg.wasm needs to even attempt loading
node test/coop-server.mjs            # http://localhost:8935

# 2. Launch Chrome headless with a remote debugging port
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --remote-debugging-port=9333 \
  --window-size=1440,900 --user-data-dir=/tmp/nx-test-profile about:blank

# 3. Run the suite
node test/run-tests.mjs
```

Exits non-zero if anything fails, with a summary at the end.

## FFmpeg-based tools (fixed — see `ensureFFmpeg()`'s own comments)

The classic per-tool destructive panels (Trim, Crop, Compress, Convert,
etc. — 10 audio + 13 video tools) and the linked-audio-extraction feature
all route through `ensureFFmpeg()`, which loads `@ffmpeg/ffmpeg` from the
jsdelivr CDN into a page hosted elsewhere. That combination breaks in two
separate, easy-to-conflate ways:

1. **Cross-origin Worker construction.** Without `classWorkerURL`,
   `FFmpeg.load()` constructs its Worker from the CDN's own URL — browsers
   have never allowed a Worker's script to be cross-origin (this predates
   and is unrelated to COOP/COEP), so it throws a `SecurityError`
   immediately. Fixed by fetching `worker.js` ourselves and handing it
   over as a same-origin `blob:` URL via `classWorkerURL` — the same
   `toBlobURL` trick already used for `coreURL`/`wasmURL`.
2. **`worker.js`'s own relative imports break once blobbed.** `worker.js`
   has two relative ES module imports (`./const.js`, `./errors.js`) that
   resolve fine from its real CDN path but have no directory to resolve
   against once loaded from a `blob:` URL. This doesn't throw a catchable
   exception — module resolution failures fire the Worker's `onerror`
   with a sanitized/empty message instead — so without also fixing this,
   `ffmpegInst.load()` just hangs forever with zero error, zero console
   output, confirmed via a CDP worker-target attach showing the worker
   dying within ~10ms of construction. Fixed by rewriting those two
   specifiers to absolute CDN URLs before blobbing `worker.js`.

Both fixes are needed together — `classWorkerURL` alone trades a fast,
clean error for a silent infinite hang, which is worse. Verified
end-to-end (real FFmpeg processing, real output file, zero console
errors) for both an audio tool and a video tool; regression-covered by
the `FFmpeg standalone tools` test group above.

The export features (`nxExportAudioMixdown`, `nxExportVideo`) still don't
route through FFmpeg — that was a deliberate, independent choice (native
is simpler and faster for both jobs, and doesn't need the ~30MB engine
download), not a workaround for this bug. `OfflineAudioContext` handles
the audio mixdown, and a canvas + `MediaRecorder` real-time capture of
the live compositor handles video — both fully native, both verified
working end-to-end by this suite.

## Vinyl audio player

Replaces the plain filename card for audio projects. Nothing about it is
independent state: disc rotation angle is `f(S.timeline.playhead)` at a
real 33⅓ RPM (not a wall-clock timer, so seeking is in sync by
construction), the reactor taps the displayed clip's actual track output
via the same `AnalyserNode` pattern built for ducking, and the play
button calls the exact `nxTogglePlay()` the timeline toolbar uses.

Selecting an audio clip in the timeline swaps which clip the vinyl
represents (title/artwork/color/source all follow); with nothing
selected it falls back to the primary audio track's clip at the
playhead. Embedded artwork is read via a real ID3v2 APIC frame parser
(MP3 only — other containers fall back honestly to a generated label
using the track's color, never fake data).

## Fixtures

`test/fixtures/test_video.mp4` (6s SMPTE color bars + 440Hz tone) and
`test_audio.m4a` (8s 660Hz tone), generated with:

```sh
ffmpeg -f lavfi -i "testsrc=size=640x360:rate=24:duration=6" -f lavfi -i "sine=frequency=440:duration=6" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest test_video.mp4
ffmpeg -f lavfi -i "sine=frequency=660:duration=8" -c:a aac test_audio.m4a
```

## DSP effects (track-level channel strip)

De-esser, 3-band EQ, compressor, delay/echo, reverb, and sidechain
ducking — all native `WebAudio` nodes (`BiquadFilterNode`,
`DynamicsCompressorNode`, `DelayNode`, `ConvolverNode` with an
algorithmically-generated impulse response), applied per-track (like
volume/pan already are), live during preview and baked into both export
paths via the same `nxConnectFxChain` builder both use — no separate
"export-only" logic to drift out of sync.

Ducking is a real sidechain: live preview uses an `AnalyserNode` tap on
the sidechain track's actual output, polled every playback tick; the
offline audio export does a pre-pass rendering the sidechain track alone
to get a real RMS-in-dB envelope, then schedules the ducked track's gain
against it with `setTargetAtTime`. It uses its own dedicated gain node
(`t._duckGain`), separate from the node clip volume/fade already
schedule ramps on — sharing one would make the two schedulers fight.

## What's intentionally NOT covered

- **Reload persistence** — the last test in the suite documents (rather
  than asserts success) that project state does **not** survive a page
  reload today. There's no save/load layer (no localStorage/IndexedDB
  project file) — reloading is equivalent to starting a new project.
  Worth building if projects need to survive a browser restart, but out
  of scope for this pass.
