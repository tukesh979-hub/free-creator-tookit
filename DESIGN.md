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
- **Tool cards converted from a card grid to a hairline-divided rail list**
  (`.tool-grid`/`.tp-grid`: `display:flex;flex-direction:column;gap:1px`
  with the gap showing through as a divider) — the brief explicitly and
  repeatedly bans "card + card + card + card + card" and asks for "compact
  professional tool tiles / rails" instead. Applied identically to the home
  tool directory, AI tools list, and every category page's full tool listing.
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

## Deliberately NOT built — flag before attempting

- **Individual tool subpages** (`/video/trim`, `/photo/crop`, etc. — full
  breadcrumb/H1/workspace/formats/workflow/features/FAQ/related-tools
  structure per tool). The brief asks for this on all ~34 tools. Two real
  constraints stopped this from being built in this pass: (1) the product is
  explicitly a single static HTML file with no server and no build step, so
  literal URL routing (`/video/trim`) isn't achievable the way a
  server-rendered site would do it — it would need client-side
  `history.pushState` faked routing, which breaks on direct reload/share
  since there's no server to resolve the path; (2) authoring genuine,
  non-generic "how it works / features / FAQ" copy for 34 tools individually
  is a real content-writing project, not a template-fill exercise — filling
  it with generated-but-thin copy would violate the brief's own "avoid
  fake/meaningless marketing sections" rule more than skipping it does.
  **Recommended next step**: decide with the user whether (a) a shared
  in-app tool-page template with real per-tool copy (written, not generated)
  is worth commissioning, and (b) whether routing should be simulated via
  `pushState` (accepting reload-to-home as a known limitation) or the product
  should gain an actual static-hosting build step.
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

**Not verified**: category pages other than Video (Photo/Audio use the same
template/function, so they're very likely fine, but weren't independently
screenshotted); the editor's crop/trim tool panels specifically at the new
type scale; tablet breakpoint (768-1024px) specifically — only mobile (390px)
and desktop (1440px) were checked.

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
