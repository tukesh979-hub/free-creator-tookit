# Nexus Creator

## What it is

A free, browser-only video/photo/audio editing toolkit. Single HTML file, no
build step, no server, no signup, no watermark. Photo editing runs on the
Canvas API; video/audio runs on FFmpeg.wasm (needs COOP/COEP headers to be
fully enabled — falls back to photo-only otherwise, honestly reported via the
nav status dot).

## Who it's for

Someone who wants to trim a clip, crop a photo, or fade an audio track right
now, without installing anything, creating an account, or trusting a random
web app with a file upload. The pitch is speed and zero friction, not a
professional NLE replacement.

## Surfaces

- **Home** (`#page-home`) — Persuade mode. Gets someone from "what is this"
  to "editing my file" in one screen: hero, upload widget, tool grids per
  category, a Quick Adjust panel that jumps straight into the editor with
  values pre-set, an AI tools teaser, a closing CTA.
- **Video / Photo / Audio** (`#page-video/photo/audio`) — Operate mode. Full
  tool catalog per category, searchable, each with a signature hover
  interaction (compare strip / scrub filmstrip / frequency bars) that echoes
  what that category's tools actually do.
- **Editor** (`#page-editor`) — Operate mode, the real workspace. Category
  rail (Video/Photo/Audio/AI Tools) → tool list → preview (drop zone / live
  preview / persistent transport bar for video / processing overlay) →
  settings panel → System Status. This is where every one of the ~34 real
  tools actually runs.

## Constraints that shape the design

- No account system, no backend — every "status" shown must be something the
  browser can actually know (this ruled out literal CPU/GPU/VRAM readouts;
  see DESIGN.md's System Status section).
- Files never leave the device. This is a selling point, not an implementation
  detail — it should read that way in copy (badges: Free / No Watermark / No
  Signup).
- Dual theme (dark default, light available) via `data-theme` — every new
  component must use the existing CSS custom properties, never a raw hex.

## Open items (not addressed by this pass)

- AI tools (remove-bg, enhance, auto-subtitle, noise-removal) are still
  placeholders — "Coming Soon" everywhere they appear (home page cards, and
  now the editor's AI Tools rail entry too), matching the mockups faithfully.
- The mockups' persistent timeline shows 3 always-visible tracks (V1 video /
  A1 audio / T1 text). Built: a real, single-track persistent transport bar
  for video (filmstrip, play/pause, click-to-seek — see DESIGN.md's Timeline
  section). Not built: a genuine multi-track timeline (simultaneous video +
  audio + text tracks editable together) — the app's data model is one tool
  acting on one file, not a multi-track project, so that's a product decision
  (does Nexus Creator become a multi-track NLE?), not a visual one. Flag to
  the user before attempting it.
- System Status shows Engine/Memory/Threads instead of the mockup's literal
  CPU/GPU/RAM/VRAM, since browsers can't read the latter. If the user wants
  it to say CPU/GPU/RAM/VRAM anyway (accepting those are estimates/simulated,
  clearly labeled as such), that's a product call — ask first.
