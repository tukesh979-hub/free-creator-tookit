# DESIGN.md — Nexus Creator

Current as of the **2026-08-14 ground-up redesign** — a full replacement of
the previous "hardware control panel / sci-fi HUD" identity, driven by an
exhaustive user-supplied brief (exact tokens, type scale, section-by-section
structure, states, responsive rules) with three.tools named as restraint
inspiration only, not a template to copy. This is a **redesign**, not a
refinement: the old look is evidence and anti-reference, not something this
pass preserved. If you're extending this system, treat *this* document as
current truth, not the git history above it.

**Process note (carried forward, proven true twice now):** never claim
visual work matches a brief without rendering it. Headless Chrome
(`--headless --disable-gpu --no-sandbox --screenshot=out.png file://…`)
catches real problems in minutes that source-reading misses entirely. For
states that need real data (a loaded file, a scrolled/interactive position,
mobile viewport), drive it through the DevTools Protocol
(`--remote-debugging-port`) — see the `zoom_shot.mjs`/`mobile_shot.mjs`
pattern: navigate, wait, optionally `Emulation.setDeviceMetricsOverride` with
`mobile:true` for accurate responsive checks (a bare `--window-size` flag
does **not** reliably reproduce mobile `@media` behavior — it produced a
false-positive "horizontal overflow" that didn't exist under real emulation).

## Identity

Restrained monochrome dark interface (predominantly black/grey/white) with
one precise red accent used only for emphasis: primary CTAs, active
states, selection indicators, tiny dot indicators. Typography carries the
page — large, bold, tight-tracked headlines; small mono-spaced technical
labels for anything numeric or system-state. Real technical grid at 2-4%
opacity, not decoration. No corner-bolt/screw hardware-panel decoration, no
pointer-tracked glows, no 3D icon tilt, no bounce easing, no gradient washes.
The product is the hero — the site should feel like the inside of a creative
tool, not a marketing page selling one.

## Tokens

```
--bg / --bg2 / --bg3 / --bg4     #080808 → #171717, darkest to lightest (dark)
--red / --red2 / --red-dark      #ff3b3b / #ff5252 / #b92727 — the ONE accent
--border / --border2             #252525 / #3a3a3a — default / hover
--text / --muted / --dim         #f5f5f5 / #a0a0a0 / #626262
--font: Inter                    Geist was specified but isn't reachable from
                                   a static single-file with no build step (no
                                   public CDN @font-face) — Inter is the
                                   brief's own named fallback.
--mono: JetBrains Mono           all technical/numeric text — labels, values,
                                   timecodes, metadata
--r-sm/md/lg/xl: 4/8/12/16px     --r-pill: 999px
--transition-fast/normal/slow: 160ms/280ms/450ms, cubic-bezier(.2,0,0,1)
--container: 1220px
```

Light theme redefines the same variable names with inverted lightness —
never hardcode a color; every new rule reaches for `var(--…)`. One exception,
clearly named: `--qa-*` tokens for Quick Adjust now just alias the normal
dark panel tokens (`--qa-bg:var(--bg2)` etc.) — an earlier pass made this an
inverted light panel to match a since-superseded mockup; this brief says
Quick Adjust should look like "a miniature version of the actual editor," so
it's a normal dark panel now, token-aliased for easy adjustment later.

## What changed from the previous system (and why)

- **Corner-bolt dots removed** from `.tcard`/`.tp-card`/`.ai-card`/`.qa-box`
  — the brief explicitly bans "overly futuristic HUD" and hardware-panel
  decoration.
- **3D pointer-tilt icons removed** (`initTiltCards()` deleted entirely, and
  its bounce easing `cubic-bezier(.34,1.56,.64,1)` — also independently
  flagged by Impeccable's own slop detector as an AI-generated-UI tell).
- **Hero spotlight glow, corner brackets, dot-grid decorations removed**
  (`initHeroSpotlight()` deleted) — "substantial negative space… typography
  should be the dominant visual element," not pointer-reactive chrome.
  Removing these also fixed two live bugs: both referenced DOM nodes that no
  longer exist and would have thrown on page load.
- **Animated grid-drift/scan-sweep hero background removed** — replaced with
  a static, near-invisible 2-4%-opacity grid (`.tech-grid` utility, reused on
  the upload workspace and editor canvas).
- **The "Pick Your Craft" 3D category showcase section removed** from the
  home page — an earlier session's addition, not in the new brief's 12-section
  structure. Markup recoverable from git history if wanted back later.
- ~~Tool cards converted from a card grid to a hairline-divided rail list~~
  **— reverted in a later pass.** This brief explicitly banned
  "card + card + card + card + card" in favor of rail rows, but the user
  directly asked afterward for tool listings back in "a Grid Box with proper
  image not svg," pointing at an earlier reference build's card sizing as the
  benchmark. `.tool-grid`/`.tp-grid`/`.ai-grid` are real CSS grid again
  (`repeat(auto-fill,minmax(216px,1fr))`), and every tool-listing surface
  site-wide — home directory, category pages, related tools, AI
  placeholders — now renders through one shared component,
  `fgridCardHTML()`/`fgridAICardHTML()` (see "Feature grid" below), instead
  of three separate rail-row templates. If a future brief wants rail rows
  back, that's a real design reversal to flag explicitly, not something to
  infer from this file alone — the user's most recent direct instruction
  wins.
- **`.hud` editor-canvas corner brackets softened** from thick always-on red
  L-brackets to thin neutral (`var(--border2)`) marks — red is reserved for
  an actual active selection/crop, not permanent canvas chrome.
- **Editor canvas gained the subtle technical grid** (`.ed-view::before`).

## New sections built (home page, in spec order)

Hero → Upload workspace → Tool directory (Image/Audio/Video/AI rail lists) →
Quick Adjust → **Video** editorial split → **Photo** editorial split
(reversed) → **Audio** full-width waveform panel → Editor showcase → Final
CTA → Footer (4-column: brand / Tools / Product / Legal).

Video/Photo/Audio/Editor-showcase visuals are **abstract, CSS-built
representations** (a frame + play icon + scrub timeline; crop-handle corners
over a gradient rectangle; ~72 CSS bars as a waveform; a simplified
rail/canvas/inspector mockup) — no stock photography or generic illustration,
per the brief's explicit media-system rules. The audio waveform
(`initAudioWaveHero()`) has a genuine subtle idle animation (`scaleY` breathe,
staggered delays) rather than being static.

## Individual tool pages (built in a follow-up pass)

Every tool in `TOOLS` (and, by construction, any future one added to that
array) now gets a real dedicated page: breadcrumb (`Nexus / {Category} /
{Tool}`) → H1 → short description → a large drop-zone workspace (the real
tool — dropping or browsing a file loads it, preselects that tool, and goes
straight to the editor) → format metadata → "How It Works" (4 steps) →
"Features" (4, in a 2×2 rail grid) → "FAQ" (3 questions) → "Related Tools"
(up to 5, same category, reusing the `.tp-card` rail component).

`toolPageHTML(t)` in the script generates this from `TOOLS` data —
`toolPageSteps()`, `toolPageFeatures()`, `toolPageFAQ()`. **Every sentence in
the generated copy is either a real, checkable product fact (runs in-browser,
file never leaves the device, no watermark, no signup, which engine it uses)
or the tool's own actual `desc` field** — never invented marketing claims or
lorem-ipsum filler. This was the deliberate resolution to the constraint
below: real facts generalize honestly across all 30 tools; fabricated
per-tool copy would not have.

**Routing**: no real URL per tool (`openToolPage(id)` swaps `#tool-page-body`
and calls the existing `goPage('tool')` SPA mechanism, same pattern as every
other page). The product is a single static HTML file with no server and no
build step, so literal paths like `/video/trim` aren't reachable the way a
server-rendered site would do it — `history.pushState` could fake the URL
bar but would 404 on direct reload/share with no server to resolve it. If
shareable tool URLs matter later, that's a hosting decision (a real static
build/server), not a template one — the template itself is already
per-tool-ready.

**Entry points**: both the home page's tool-directory rail rows and every
category page's full tool listing now call `openToolPage(id)` instead of
jumping straight to the editor (`launchTool(id)` still exists, now unused,
left in place rather than deleted in case a "skip straight to editor"
fast-path is wanted later).

## Feature grid — "Explore Every Tool" (home page)

An illustrated overview of all 34 tools (30 real + 4 AI placeholders),
requested explicitly by the user after finding the plain rail-list tool
directory (5-per-category preview, text only) insufficient — they wanted
something more visual, "images explaining what it does" per tool.

No real photo/screenshot assets exist or can be generated for 34 tools, so
this is built compositionally rather than as 34 bespoke illustrations:
`fgridCardHTML(t)`/`fgridAICardHTML(t)` compose a **category-styled frame**
(photo = crop-handle corners, same motif as the editorial section; video = a
scrub bar with playhead; audio = a waveform baseline; ai = plain plate +
amber "Soon" badge) with the tool's **own real icon** from the existing
`TOOL_ICONS` set as the focal mark, plus name and `desc`. Generated straight
from data — never hand-duplicated.

**This became the one canonical tool-card component, not just this
section's.** In a follow-up pass the user asked for every tool *listing*
site-wide back in grid form (see the struck-through rail-list entry above),
so `fgridCardHTML`/`fgridAICardHTML` now also power the home directory
previews (`renderHomeGrids`), every category page's full listing
(`renderToolPage`), and Related Tools (`toolPageHTML`) — one component, one
place to change the tool-card look. `renderFeatureGrid()` (this section
specifically) is the only caller that renders the complete, unfiltered
`TOOLS`/`AI_TOOLS` arrays; the others slice/group/filter first. Verified via
screenshot at desktop (4-column) and mobile (1-2 column, `auto-fill
minmax(216px,1fr)` handles the reflow with no CSS overrides needed) across
all four call sites, plus a live `filterTools()` check confirming search
still works against the new `.fgrid-card` markup (`data-name`/`data-desc`
carried over from the old `.tp-card` attributes).

Sits between the AI Tools rail and Quick Adjust — after the compact
directory (quick scan + jump to editor), before the interactive demo.

## Deliberately NOT built — flag before attempting

- **A literal multi-track (V1 video / A1 audio / T1 text) timeline** — the
  app's data model is one tool acting on one file, not a multi-track project.
  Building the mockup's persistent 3-track timeline literally would mean
  fabricating tracks with no underlying function. A single-track, fully real
  persistent video scrubber (filmstrip + play/pause + seek, wired to the
  actual `<video>` element) already exists from an earlier pass
  (`initEdScrubber()`) and was left as-is — it's genuine, just not "3 tracks."
- **Real zoom controls on the editor canvas** — the brief's example shows
  "ZOOM − 100% +" but no zoom/pan functionality exists in the app currently.
  Added as a purely illustrative detail in the home page's Editor Showcase
  section (which is explicitly a decorative preview, not live UI), but not
  added to the real editor, per the brief's own rule: "Only show controls
  where they make functional sense… do not add fake UI simply for
  decoration."
- **CPU/GPU/RAM/VRAM literal readouts** in editor System Status — carried
  over from an earlier pass's honesty tradeoff (browsers cannot read real
  system stats; shows Engine/Memory/Threads instead, all genuinely
  measurable). Still unresolved whether the user wants this to read literally
  as CPU/GPU/RAM/VRAM with an accepted "estimated" caveat instead — ask
  before changing.

## Verified this pass

Headless-Chrome screenshots (desktop): hero/nav/upload-workspace checkpoint,
full home page, video category page, editor empty state. DevTools-Protocol
screenshots: editor with a real generated test video loaded (confirmed real
filmstrip + playhead + track badge render correctly), mobile-width home page
(390px, proper `mobile:true` emulation — confirmed no overflow, nav collapses
correctly, feature sections stack), light theme (confirmed token inversion
holds across hero/upload/tool-rail/badges).

**Verified in a follow-up pass** (closing the gaps flagged above): tablet
width (390/768/820px, editor + home), Photo and Audio category pages
(confirmed same clean rail-list/search/banner layout as Video). Found and
fixed a real bug that predated this redesign and carried forward unnoticed —
see "Responsive fixes" below. Also found, and ruled out as a false positive,
an apparent "blank editorial visual" at both tablet and desktop width: a
clip-region `Page.captureScreenshot` call was silently returning black for
that specific element regardless of viewport size, while a plain
scroll-into-view + full-viewport screenshot showed it rendering correctly
(play icon, scrub bar, technical grid, all present). **Lesson, stacked on
the one above: if a screenshot shows something suspicious that contradicts
plausible computed-style output (real dimensions, real colors, opacity:1,
visibility:visible), cross-check with a second, differently-constructed
screenshot before reporting it as a bug** — the capture method itself can be
wrong, not just the page.

**Still not independently verified**: the editor's crop/trim tool panels
specifically at the new type scale.

## Real bug: Effects panel sliders overlapping their own labels

The type-scale passes above (10-16px, then 13-20px) fixed readability but
broke a layout that depended on the old smaller size: `fxRow()` (the
Brightness/Contrast/Saturation/Hue/Sharpness/Blur/Vignette sliders in the
Effects panel) put the label in a fixed `width:76px` column sharing a row
with the slider track. At the bigger font, "BRIGHTNESS"/"SATURATION"
overflowed that 76px and visually overlapped the track — the slider's own
line rendered straight through the label text.

Rather than just widen the label column (fragile — the next type-scale
change breaks it again the same way), restructured to a two-row pattern:
label + value on their own flex row, full-width `<input type=range>` on the
row below. New classes (`.fx-slider`/`.fx-slider-hdr`/`.fx-slider-label`/
`.fx-slider-val`), *not* a change to `.fx-row` itself — `.fx-row` is reused
elsewhere (POSITION/TYPE/TRUE PEAK rows, the video/audio track-badge
headers) for label-plus-other-content layouts that don't have this failure
mode, and blanket-converting it risked breaking those. Also had to update
`applyFxPreset()`'s slider-sync code, which queried `.fx-row`/`.fx-row-val`
by class name to push preset values into the visible sliders — missed this
initially, would have silently broken "click a preset, sliders don't move."
Verified: clean stacked layout, no overlap, and preset-sync still works.

Same lesson as the panel-widening note below: a font-size change isn't
component-agnostic. Check every layout that positions text next to a fixed-
width sibling before shipping "make it bigger," not just the font-size
declarations themselves.

## Editor panels widened again — still felt cramped after the first pass

The panel widths bumped alongside the first type-scale increase (.ed-cat
56->72px, .ed-tools 140->184px, .ed-right 240->280px) weren't enough —
reported as "congested" with a follow-up screenshot. Widened again, more
generously this time: `.ed-cat` 72->84px, `.ed-tools` 184->224px, `.ed-right`
280->344px, plus real padding increases inside them (`.tool-btn` 8px/12px->
11px/18px, `.er-body`/`.er-head`/`.er-foot`/`.er-status` all bumped from
12-14px to 16-20px). Mobile drawer variants updated to match — `.ed-tools`
drawer 240->260px isn't needed (was already wider than desktop), but
`.ed-right` drawer now uses `width:min(344px, 92vw)` so it matches the new
344px desktop panel on tablets while still fitting narrow phones without
overflowing past the screen edge.

## Editor preview: real vertical-centering bug + image too small

User reported a big "black fill box" around the loaded image with the image
sitting off-center. Measured it precisely (`getBoundingClientRect()` on the
image and its `.ed-view` container, not eyeballing a screenshot) rather than
guessing, since this session already burned a round on a false-positive
"blank visual" that turned out to be a screenshot-tooling artifact.

**Horizontal centering was already exact** (59.6px both sides). **Vertical
centering had a real ~33px offset**, caused by `.preview-meta` (the
`filename · size · dimensions` caption) being an inline flex sibling of
`#preview-img` inside `.preview-area`'s centered flex column — flexbox was
centering the *(image + caption)* group as one unit, which visibly pushes
the image itself above true center by roughly half the caption's height.
Fixed by taking `.preview-meta` out of the centering flow entirely:
`position:absolute;bottom:12px` within `.preview-area` (now
`position:relative`), so the image is the sole flex-centered child and
centers on its own. Applies to both the photo and video preview branches
(they share the same `.preview-area`/`.preview-meta` structure).
Re-measured after the fix: 71.0px top and bottom, effectively identical.

**Separately, the image was capped at only 55vh** — on a wide-but-short
editor canvas, a square or portrait image hitting that height cap leaves
large empty margins on both sides, which read as an oversized "black box."
Bumped the cap to 78vh in the four places it's defined
(`.vid-preview-wrap`, the `<video>` inline style, the photo `<img>` inline
style, and the Resize tool's `getFrame()` — the same four spots that had to
move together last time to avoid the Crop/Resize scale-jump bug). Verified
with a real 1080×1080 test image: renders at 702×702 now vs. ~495×495
before, ~42% larger per side, still centered exactly, and Crop/Resize still
agree on height (702px both).

## Type scale — second, larger pass

The first readability pass (6-9px labels bumped into a 10-16px range) wasn't
enough — reported "still smaller" afterward. Re-mapped a second time, working
off the *already-bumped* values, into a 13-20px range (9→13, 10→14, 11→15,
12→16, 13→17, 14→18, 15→19, 16→20, 18→22, 28→32px), plus inline `<svg
width= height=>` icon dimensions bumped on the same scale (11→14 through
24→26px) and `iconSVG()`'s default param 18→20.

**Widening text without widening its container just wraps — this bit the
editor sidebar.** `.ed-tools` was still 140px wide; "EXTRACT AUDIO"/"REMOVE
AUDIO"/"TO VERTICAL" at the new 16px stopped fitting on one line. Whenever a
type-scale pass touches a fixed-width panel with real label text in it
(not just a paragraph that can reflow), check the panel's width against the
new font size, not just the font-size rule itself. Widened `.ed-cat` 56→72px,
`.ed-tools` 140→184px, `.ed-right` 240→280px (desktop and the matching mobile
drawer variants), and `.er-stat-row`'s grid columns 50px/36px→66px/46px for
the System Status labels/values. Verified via screenshot at desktop
(1440px, no wrapping) and mobile (390px, still reflows cleanly).

Still genuinely fixed-px, not fluid/viewport-relative, except the hero H1
(already `clamp()`-based). If this still reads small on a specific display,
the next lever isn't another blanket px bump — it's `clamp()`-driven fluid
type on the recurring small-label patterns, which needs to know the actual
viewport/resolution in question rather than guessing a third time.

## Responsive fixes (found in a follow-up pass, predate this redesign)

Two real bugs in the nav/editor responsive CSS — present before this
redesign, carried forward unchanged by it since it touched tokens/typography/
decoration, not the responsive rules, and confirmed via
`Emulation.setDeviceMetricsOverride` (not a bare `--window-size` flag, which
gives false results — see the process note at the top of this file):

- **Editor was structurally broken at ≤900px width, not just cramped.**
  `.ed-toolbar` (the mobile "Tools / No Tool / Settings" bar) is a direct
  child of `#page-editor`, which is `flex-direction:row` at every width by
  default. Without an override, the toolbar was laid out as a same-row flex
  item sized to its own content (~270px) instead of a full-width bar stacked
  above the content — squeezing the preview/drop-zone into a ~100-120px
  sliver jammed against the right edge. Fixed with
  `#page-editor.active{flex-direction:column}` inside the existing
  `@media(max-width:900px)` block; `.ed-cat`/`.ed-tools`/`.ed-right` are
  already `display:none`/`position:fixed` at that width so they don't
  participate in the flow either way — only `.ed-toolbar` and `.ed-main` do,
  and column stacking is what the toolbar always needed.
- **Nav and editor sidebar collapse used two different breakpoints**
  (700px vs 900px), so in the 701-899px gap the full desktop nav (all links,
  status, theme toggle) rendered at the same time as the editor's mobile
  toolbar and floating action buttons — two visible "Settings" affordances,
  cramped nav wrapping. Moved the nav's collapse
  (`.nav-links`/`.hamburger`/`.status`/`.theme-toggle`) into the same
  `@media(max-width:900px)` block the editor already used; the grid
  column-count tiers (`.tool-grid`, `.tp-grid`) are an independent concern
  and stayed on their own 900/700px cascade.

Verified at 320/390/768/820px (mobile toolbar drawer open + closed) and
1440px (confirmed the fix didn't touch desktop).

## Resize tool: black pillarbox around the frame

Reported with screenshots: Crop tab showed the image clean, no backdrop;
Resize tab showed the same image sitting inside a large solid-`#0c0c0c`
rectangle, with black bars on both sides even in Crop-to-Fill mode where the
image should cover edge-to-edge.

Root cause: `getFrame()` (the Resize overlay canvas's geometry function)
computed two nested boxes — an outer envelope `pW × pH` (90% of the preview
area's width, capped at 78vh height, matching the plain `<img>`'s CSS
constraint) and an inner `fW × fH` frame inset a further 10% inside that
envelope. The canvas was sized to the *outer* envelope and unconditionally
filled solid `#0c0c0c` before drawing the frame — so anything in the 10%
margin between the two boxes rendered as flat near-black dead space around
the image, regardless of fit mode.

Fixed by collapsing the two boxes into one: `getFrame()` now returns only
`{fW, fH}`, computed directly against the same envelope the plain `<img>`
uses (no extra 90%-of-90% inset), and the canvas is sized to exactly `fW ×
fH` — the canvas *is* the frame, so there's no leftover area to paint a
background into. It's centered in the preview area by setting `left`/`top`
explicitly from `previewEl`'s rect on every redraw (not by flex
auto-centering — the hidden `<img>` sibling still occupies its own layout
box even at `visibility:hidden`, so letting flexbox center the pair would
reproduce the earlier "centering a group" bug from the black-box/portrait-
image fix above). The solid-black fill is now conditional on `letterbox`
mode only, and only covers `0,0,fW,fH` — real letterboxing (image doesn't
cover a mismatched-aspect frame) still shows correctly, it just no longer
bleeds past the frame's own border. Verified via direct CDP reproduction:
Crop and Resize now render the identical frame size/position for the same
file (no jump switching tabs), and Letterbox mode's bars stay strictly
inside the red frame border with nothing outside it.

## Editor preview: image/video border was invisible

The plain preview `<img>` and `<video>` both had `border:1px solid
var(--border)`. `--border` is `#252525` in dark mode against an `.ed-view`
background of `#080808` — a ~4% lightness difference, effectively invisible
— and symmetric in light mode (`#e3e3e0` border on `#fafaf9` bg). Worse,
even a higher-contrast dark gray wouldn't reliably show up against a photo
whose own edge pixels happen to be dark (exactly the case in the reported
screenshot).

Added a new token, `--preview-border` — a translucent light overlay in dark
mode (`rgba(255,255,255,.22)`) and a translucent dark overlay in light mode
(`rgba(0,0,0,.18)`) — so the border reads by contrast against the canvas
background regardless of what color the image's own edge happens to be, and
regardless of theme. Applied at `2px` (was `1px`) with a soft
`box-shadow:0 8px 28px rgba(0,0,0,.35)` for depth, to both the photo
`<img>` (`renderPreview()`) and `.vid-preview-wrap video`. Doesn't touch the
Resize/Crop canvas frame — that already draws its own high-contrast red
border on purpose (red is reserved for an active selection). Verified in
both themes via screenshot.

Follow-up: widened 2px → 5px per request, then swapped the flat translucent
overlay for an actual gradient. `--preview-border` (the rgba overlay) is
gone, replaced by `--preview-border-gradient` — a single token defined once
in the base `:root{}` (not per-theme) as `linear-gradient(135deg,
var(--red2), var(--red) 45%, var(--red-dark))`. Since it references the
existing red tokens instead of hardcoding hex, it's already theme-correct
without a light/dark split. Applied via `border:5px solid
transparent;border-image:var(--preview-border-gradient) 1` on both the
photo `<img>` and the video preview — `border-image` was the only way to
get a CSS gradient onto a border on a *replaced element* (`<img>`/`<video>`)
without wrapping it in an extra div. One accepted tradeoff: `border-image`
doesn't respect `border-radius`, so corners are technically square under
the gradient rather than following the existing 6px rounding — invisible in
practice at this border width, confirmed by pixel-cropping both corners of
a screenshot (lighter red2 top-left fading to dark red-dark bottom-right,
matching the 135deg direction, no visible corner artifact). Reuses the same
two template strings as the earlier fix, so it's automatically consistent
across every photo/video tool without per-tool styling.

**Follow-up: the border was on the wrong element.** Two real bugs reported
together: (1) Effects sliders (brightness/contrast/saturation/hue) visibly
recolored the border as they moved, and (2) the border vanished entirely on
the Resize/Crop tab. Same root cause for both: `border-image` lived directly
on `#preview-img`/`#preview-vid`, but so does every live-preview effect —
`applyLivePreview()` sets `img.style.filter = 'brightness(...) ...'` on that
exact element, and CSS `filter` rasterizes an element's *entire* rendered
box as one unit, border included, so the gradient was getting brightness/
contrast/hue-rotated right along with the photo. Separately,
`initResizeFrameCanvas()` sets `img.style.visibility = 'hidden'` to let the
canvas take over rendering — since the border lived on that same now-hidden
element, it disappeared with it, leaving only the canvas frame's flat
`#e5383b` 1px stroke.

Fixed by moving the border+shadow off the media element entirely, onto a
non-filtered parent: added `.img-preview-wrap` (mirroring the `.vid-preview-
wrap` pattern video already had) and moved `border-image`/`box-shadow` from
`.vid-preview-wrap video` up to `.vid-preview-wrap` itself. `filter` is only
ever set on the inner `<img>`/`<video>`, so it now has no way to touch the
border — confirmed by cranking brightness/contrast/saturation/hue-rotate to
extreme values via CDP and screenshotting: the image content shifted
dramatically, the border didn't move at all.

For Resize/Crop: hiding just the inner `<img>` now leaves the wrapper (and
its border) visible behind the canvas, which would show a stale natural-
aspect ring misaligned with the canvas's own target-aspect frame — so
`initResizeFrameCanvas()`/its cleanup/`setCRTab()` now toggle
`img.closest('.img-preview-wrap')`'s visibility alongside the image's, and
the canvas's own frame stroke (`redraw()`, "frame border + corner L-marks")
was upgraded from flat `#e5383b` to a `ctx.createLinearGradient(0,0,fW,fH)`
using the same red2→red→red-dark stops (hardcoded, since canvas can't read
`var()` — this frame was already theme-independent before) at 5px instead
of 1px. Net effect: there's always a red-gradient border on-screen no
matter which tool is active, it just changes mechanism (CSS `border-image`
for the wrapper, canvas stroke for Resize/Crop) — never a flat color, never
absent. Verified corner colors by pixel-cropping the canvas frame the same
way as the CSS version (light red2 top-left → dark red-dark bottom-right),
and confirmed switching Resize→Crop→Resize doesn't leave the wrapper stuck
hidden.

One side note while auditing this: `drawWatermarkPreview()` positions its
canvas via `img.parentNode` and `img.offsetLeft/Top/Width/Height` — still
correct with the new wrapper in between, since it dynamically reads
whatever `img.parentNode` currently is rather than assuming it's
`#ed-preview` directly, and `offsetWidth/Height` on the unbordered `<img>`
now measures pure content size instead of content+the-old-inline-border, if
anything slightly more accurate than before.

## Custom tool icons — drop-in folder + build script

User wants to hand-generate real icon art (segmented by video/photo/audio)
rather than keep using the built-in inline-SVG glyph set, and wants a
low-friction handoff: drop image files in, they end up on the site, no
back-and-forth pasting code.

Since this is a single static HTML file with no backend, "uploaded to the
website" can only mean embedded as `data:` URIs directly in the file — there's
no server to host separate asset files against. Landed on: a plain folder
(`icons/{video,photo,audio,ai}/<tool-id>.{png,webp,jpg,svg}`, filename =
exact `TOOLS`/`AI_TOOLS` id) plus `icons/build.mjs`, a dependency-free Node
script that scans the folder, normalizes raster images to ≤256px PNG via
macOS `sips` (SVGs pass through as vector text), base64-encodes everything,
and replaces a `CUSTOM_ICONS` object literal between
`// CUSTOM_ICONS:START`/`:END` markers in `Nexus Creator.html`. Re-running it
is idempotent — full replace, not append.

On the render side: a new `toolIconHTML(id, fallbackKey, size)` helper
(next to `fgridCardHTML`) checks `CUSTOM_ICONS[id]` first and renders an
`<img>`, falling back to the existing `iconSVG(fallbackKey, size)` when
there's no entry. Wired into both `fgridCardHTML` (the 32 real tools) and
`fgridAICardHTML` (the 4 AI tools, which previously all shared one generic
`'ai'` glyph with no per-tool distinction at all). Because it's a fallback
rather than a hard requirement, uploads can be partial — the grid never
looks broken or incomplete mid-rollout, tools without a custom icon yet
just keep their current glyph.

Verified with a synthetic test icon end-to-end: dropped a file at
`icons/video/video-trim.png`, ran the build, confirmed via screenshot that
the Trim card (and only the Trim card) picked up the custom image on both
the category page and the home page's "Explore Every Tool" grid, then
removed the test file and re-ran the build to confirm it correctly resets
back to `CUSTOM_ICONS = {}` (0/36) rather than leaving a stale entry
behind. Also checked `ai-removebg` the same way to confirm the AI grid's
new per-tool fallback works, not just the regular tools grid.

`icons/README.md` has the full filename checklist (all 36 ids across the
four folders) so future uploads don't need this file re-explained.

## Editor category tabs weren't locked to the loaded file

Real bug, not cosmetic: `loadFile()` auto-switched the sidebar to the right
category (`setCat(cat)`) when a file loaded, but `setCat()` itself had no
guard — clicking Video/Photo/Audio afterward switched the tool list freely
regardless of what was actually loaded. Load a photo, click "Video," pick
Trim, and the tool panel would build itself around a video file that
didn't exist.

Fixed with a single source of truth, `catForFileType(type)` (image→photo,
video/audio pass through), used in three places: `setCat()` now refuses
the switch (and shows a status message explaining why) if a file is loaded
and the target category doesn't match it; a new `updateCatLock()` dims the
mismatched tabs (`.cat-btn.locked`, called from `loadFile()` and
`resetEditor()`) so it's visible *before* the click, not just blocked
after; and `onToolPageFile`/`onToolPageDrop` (dropping a file directly on
a specific tool's page) now only jump to that tool if the dropped file's
type actually matches it, otherwise falling through to `loadFile()`'s own
correct auto-selection. AI Tools stays exempt from the lock — it's all
"Coming Soon" placeholders, not real per-file processing, so there's
nothing to protect there.

Verified via CDP end-to-end, not just read the diff: loaded a photo,
confirmed Video/Audio tabs got `.locked` + a click on Video left `S.cat`
at `'photo'` + showed the explanatory status message; reset and confirmed
all three unlocked again; loaded audio and confirmed the inverse (Photo/
Video locked, Audio not, AI still clickable and unaffected); and opened
the Video→Trim tool page and dropped a photo onto it, confirming it lands
on Photo→Crop rather than leaving a photo loaded under a video tool.

## What NOT to do here

- Don't hardcode a color — reach for `var(--…)`, including in inline
  `style=` attributes on generated markup.
- Don't reintroduce a card grid for tool listings — it's a rail list now,
  everywhere, on purpose.
- Don't add decorative interactive controls with no real function (zoom, fake
  system stats, fake multi-track) — see "Deliberately NOT built" above for
  the standard this project holds to and why.
- Don't test mobile/responsive behavior with a bare `--window-size` headless
  flag — it does not reliably match real `@media` viewport behavior. Use
  `Emulation.setDeviceMetricsOverride` with `mobile:true`.
- Don't touch `.hud` and give it back its red always-on brackets — red is for
  an active selection only now.
