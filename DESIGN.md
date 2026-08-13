# DESIGN.md — Nexus Creator

Derived from the shipped file (`Nexus Creator.html`), current as of the
2026-08-14 redesign pass driven by user-supplied mockups (Editor + Front Page,
dark and light). That redesign kept the existing "hardware control panel"
identity — corner brackets, mono-uppercase labels, red accent, screw/bolt
panel decoration — and pushed it further (rounder corners, corner-bolts on
more surfaces, a functional rotary dial) rather than replacing it, because the
mockups turned out to already be a refinement of this same system, not a
different one.

**Process note:** the first version of this pass was reported "not even close
to my reference images" — shipped from source-code reading alone, without
ever rendering the page. A headless-Chrome screenshot pass afterward found
the real causes in minutes: an extra, un-briefed home page section thrown off
the whole rhythm, and the rebuilt Quick Adjust panel was nearly illegible.
Both got fixed once actually visible. **Screenshot before claiming visual
work matches a reference — reading CSS is not the same as seeing the page.**

## Identity

A dark-sci-fi-HUD-meets-hardware-panel toolkit. Think a rack-mounted audio
processor, not a generic SaaS dashboard: corner brackets on the live preview,
screw-dot corners on panels, mono/uppercase micro-labels, a single red accent
carrying all emphasis.

## Tokens

```
--bg / --bg2 / --bg3 / --bg4   surface depth, darkest to lightest (dark theme;
                                 inverted lightest-to-darkest in light theme)
--red / --red2                 the one accent color, hover state is --red2
--border / --border2           hairline / slightly-stronger hairline
--text / --muted / --dim       text hierarchy, --dim is near-invisible unless labeled
--green / --amber / --blue     status semantics only (ok / warn / info) — never decorative
--font: Syne                   display font, headings/buttons/labels
--mono: JetBrains Mono         everything technical — labels, values, timecodes
--r-sm / --r-md / --r-lg       6 / 10 / 16px — see Radius scale below
--r-pill                       999px — sliders, toggles, badges
```

Both themes are driven entirely by `:root[data-theme="dark"|"light"]`
redefining the same variable names — never hardcode a color. The one
deliberate exception is `.tpi-photo-before`'s grayscale gradient, which is
*meant* to look dull/unedited regardless of site theme (it's illustrating
"before", not adapting to a theme).

## Radius scale (added this pass)

Two tiers, chosen by mode:
- **Operate surfaces** (editor internals — buttons, inputs, small chips,
  dense settings-panel controls): a flat, uniform bump from the old 2px to
  **6px**. Enough to soften the "PCB" harshness, not enough to fight
  scanability in a dense panel. This was a single global substitution — see
  `border-radius:6px` throughout.
- **Persuade surfaces** (home page cards, upload widget, Quick Adjust panel):
  `--r-md` (10px) for tool cards, `--r-lg` (16px) for larger panel-level
  surfaces. These are where the mockups show the most visible rounding, and
  where expression matters more than density.

## Corner-bolts (`.bolts` pattern)

Four small dots at each corner, composited as CSS `background-image`
radial-gradients — no extra DOM nodes. Applied to `.tcard`, `.tp-card`,
`.ai-card`, `.qa-box`. The upload widget (`.upload-box`) already had this via
real `.ub-screw` divs from earlier work — left as-is, not migrated, since it
already renders identically.

**Deliberately not applied** to the editor's docked side panels
(`.ed-tools`, `.ed-right`) — those are dense Operate-mode surfaces where the
mockup itself doesn't show bolt decoration, and adding it would compete with
the actual controls. The one corner-treatment the editor keeps is `.hud` —
the sharp red L-bracket on the live preview frame — a deliberately different,
sharper accent language reserved for exactly one element, the thing the user
is actually looking at.

## Category showcase section — removed

The home page had a "Pick Your Craft" section (3 large cards, layered 3D
icons) between the upload widget and the tool grids, built in an earlier
session. The mockups don't show it at all — the page goes straight from
upload widget to `IMAGE TOOLS`. It was pulled from the render path (HTML
removed, `initCatShowcase()` call removed) rather than deleted outright — the
markup is recoverable from git history if it's wanted back, just not as a
default section between two things the mockup places adjacent.

## Quick Adjust panel (rebuilt this pass, then fixed after screenshot review)

Home page → jumps into the editor's `photo-effects` tool with values
pre-filled. Originally four flat horizontal sliders + a plain button.

- **A dedicated "lit panel" token set** (`--qa-bg`/`--qa-text`/`--qa-dim`/
  `--qa-border`/`--qa-track`): in dark theme these resolve to light, near-white
  values — the mockup shows Quick Adjust as a distinctly lit control panel
  against the dark page, not just another dark card. In light theme they
  resolve back to the normal card tokens, since the whole page is already
  light there and there's nothing to invert against. Same pattern as
  `.tpi-photo-before`: a deliberate, named, theme-aware exception — never an
  ad hoc hardcoded color.
- **Vertical faders** (Brightness/Contrast/Saturation/Sharpness): a standard
  horizontal `<input type=range>` rotated -90° in an absolutely-positioned
  wrapper — bottom = min, top = max, matching hardware fader convention.
  `paintQAFader()` paints a real two-tone gradient fill on the track itself
  (from center for the bipolar ones, from zero for Sharpness) — the first cut
  only styled the thumb, which rendered as a nearly-invisible dot on a
  same-color track. Track thickness 6px, thumb 20px, called on `input` and
  once at load (`initQAFaders()`).
- **Rotary dial** ("Preview"): genuinely functional, not decorative —
  pointer-drag (vertical, hardware-synth-knob convention: drag up =
  increase) or arrow keys set a real 0–200% intensity multiplier
  (`initQADial()`), which scales all four fader values before they're handed
  to the editor. 100% = pass-through.
- **Apply to All toggle**: honest semantics — when off, only channels the
  user actually moved off zero are sent to the tool; channels left at 0 are
  left alone rather than explicitly zeroed. This was chosen over a fake
  "batch of images" meaning, since the app has no multi-file batch model to
  apply to.

## System Status (added this pass)

The mockups show CPU/GPU/RAM/VRAM bars. Browsers cannot read any of those —
there is no DOM API for system CPU/GPU/VRAM usage. Rather than fabricate
numbers, the panel reports three things the page can actually know:

- **Engine** — mirrors the existing `SharedArrayBuffer` capability check
  (same signal already driving the nav status dot).
- **Memory** — `performance.memory` (Chrome-only; shows "N/A" elsewhere
  rather than a fake bar), polled every 3s.
- **Threads** — `navigator.hardwareConcurrency`, a real, standard, cross-browser
  API.

If this needs to visually read as "CPU / GPU / RAM / VRAM" to match the
mockup more literally, that's a product conversation (is a fake-but-labeled
number acceptable here?) — not something to silently change.

## Editor icon rail — AI Tools added

The mockup's left icon rail has 4 entries (Video/Photo/Audio/AI Tools); the
app had 3. Added the 4th. Clicking it shows the same `AI_TOOLS` list already
used on the home page's "Coming Soon" section — disabled rows with a `SOON`
badge, not real selectable tools (`AI_TOOLS` isn't part of the `TOOLS` array
`byCat()` filters, so this needed its own branch in `renderToolList()` rather
than pretending they're normal category tools).

## Timeline

The mockups show a persistent bottom timeline with three always-visible
tracks (V1 video / A1 audio / T1 text) plus a transport bar (play/pause,
timecode) under the preview. The app has no multi-track data model — one
tool acts on one file — so a literal 3-track timeline would be fabricated UI.
What *is* real and was missing: the video preview relied on the browser's
native `<video controls>` skin, which looks nothing like the mockup and sits
inside the video frame rather than as a separate branded bar below it.

Built `initEdScrubber()` (`.ed-scrub`, shown for video, hidden for
audio/photo): removed the `controls` attribute from `#preview-vid`, added a
persistent bar with a real V1 badge, a real filmstrip (reuses the existing
`drawVideoFilmstrip()`), a real play/pause button, and click/drag-to-seek —
all wired to the actual `<video>` element's `play()`/`pause()`/`currentTime`/
`timeupdate`, not a simulation. It initializes once per file load (the video
element persists across tool switches — `selectTool()` doesn't recreate it —
so no re-init needed when the user picks a different tool). Audio already had
its own custom waveform player (`buildAudioPlayer()`) with equivalent
scrub/play functionality predating this pass, so it was left alone rather
than duplicated; the persistent bar is video-only. No T1 text track exists
anywhere in the data model, so none was added.

The pre-existing trim-specific timeline (start/end handles, used only inside
`video-trim`/`audio-trim` settings) is a separate component from this
persistent scrubber and still has its own `V1`/`A1` track-badge chip from the
first pass — the two coexist: the persistent bar always shows current
position, the trim panel's timeline is specifically for setting an in/out
range.

## Per-category interactive banners (earlier pass, still current)

`Photo Tools` / `Video Tools` / `Audio Tools` each get one hover-driven
banner under the header (`initCategoryBanner()` → `initPhotoBanner()` /
`initVideoBanner()` / `initAudioBanner()`): a before/after reveal, a
hover-scrub filmstrip, and pointer-reactive frequency bars respectively. Idle
= ambient CSS loop; pointermove hands control to JS. Same pattern as the home
page's `initCatShowcase()` category cards.

## What NOT to do here

- Don't hardcode a hex color — every new rule must reach for an existing
  `var(--…)`.
- Don't add decorative interactive controls that don't do anything real (see
  System Status, Apply-to-All above for the standard this project holds to).
- Don't apply `.bolts`-style corner decoration to dense Operate panels — it's
  a Persuade-surface accent, not a global texture.
- Don't touch `.hud` styling or reuse its sharp-bracket language elsewhere —
  it's reserved for the live preview frame specifically.
- Don't claim a redesign matches a reference without rendering it. Use a
  headless-Chrome screenshot (`--headless --disable-gpu --no-sandbox
  --screenshot=out.png file://…`) at minimum for static states; for a state
  that needs real data (a loaded file, a playing video), drive it through
  the DevTools Protocol (`--remote-debugging-port`) rather than guessing —
  see the process note at the top of this file.
