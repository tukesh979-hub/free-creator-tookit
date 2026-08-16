# Nexus Creator

A free, browser-only video, photo, and audio editing toolkit. No install, no
build step, no server, no signup, no watermark — everything runs as a
single HTML file, and your files never leave your device.

## What's inside

- **23 one-shot tools** — trim, crop, resize, rotate, compress, convert,
  speed, reverse, extract/remove/mute audio, adjust, watermark, and more,
  split across Video, Photo, and Audio.
- **A professional multi-track timeline editor** — video (V1–V5) and audio
  (A1–A6) tracks, drag/trim/split/duplicate/delete clips, ripple editing,
  snap, zoom, markers, a non-destructive Inspector (transform, speed, crop,
  volume, pan, fades), text layers, and linked video+audio.
- **Real audio DSP** — EQ, compressor, reverb, delay, sidechain ducking,
  de-esser — all live Web Audio nodes, not simulated controls.
- **A premium vinyl-style audio preview** — a spinning record that's a real
  function of playback position, with a 64-bar spectrum reactor driven by
  live frequency data.
- **Real exports** — audio mixdown via `OfflineAudioContext`, video export
  by capturing the live compositor through `canvas` + `MediaRecorder`.

## Running it

Nothing to install. Open `Nexus Creator.html` directly in a browser and
it works — photo tools run entirely on the Canvas API, no special hosting
required.

Video/audio tools use FFmpeg.wasm, which needs `SharedArrayBuffer`. That
requires the page to be served with COOP/COEP headers rather than opened
as a local `file://` path:

```sh
node test/coop-server.mjs        # serves the app at http://localhost:8935
```

Then open `http://localhost:8935/Nexus%20Creator.html`. Without those
headers, video/audio tools are unavailable and the app reports this
honestly via its status indicator — it never fakes support.

## Testing

A durable regression suite drives real Chrome via the DevTools Protocol —
zero npm dependencies, just Node (v18+):

```sh
node test/coop-server.mjs &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --remote-debugging-port=9333 \
  --window-size=1440,900 --user-data-dir=/tmp/nx-test-profile about:blank &
node test/run-tests.mjs
```

See `test/README.md` for what's covered and known platform limitations.

## Project structure

```
Nexus Creator.html   the entire app — markup, styles, and logic
test/                CDP-driven regression suite + fixtures
icons/                custom tool icon build pipeline
PRODUCT.md            product surfaces and design constraints
DESIGN.md             design system reference
```

## Privacy

Files are processed entirely in your browser and are never uploaded
anywhere. That's a core design constraint, not an incidental detail.
