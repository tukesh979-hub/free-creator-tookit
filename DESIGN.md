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
