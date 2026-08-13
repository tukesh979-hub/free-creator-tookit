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
  rail → tool list → preview (with drop zone / live preview / processing
  overlay) → settings panel → System Status. This is where every one of the
  ~34 tools actually runs.

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
  placeholders — "Coming Soon" on the home page, matching the mockups faithfully.
- The mockups' bottom persistent multi-track timeline (V1/A1/T1 always
  visible) implies a different interaction model (multi-track NLE) than what
  exists (one tool active at a time). Only the *existing* trim timeline was
  restyled to match the track-row look — no fake tracks were added. Building
  a real persistent multi-track timeline would be a product decision, not a
  visual one — flag to the user before attempting it.
