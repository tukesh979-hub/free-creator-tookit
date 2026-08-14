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

- **Home** (`#page-home`) — Persuade mode. A single long page, each section a
  different composition (not a repeated card grid): hero → upload workspace
  → tool directory (Image/Audio/Video/AI, each a hairline-divided rail list)
  → Quick Adjust interactive demo → Video editorial split → Photo editorial
  split (reversed) → Audio full-width waveform → Editor showcase → final CTA
  → footer.
- **Video / Photo / Audio** (`#page-video/photo/audio`) — Operate mode. Full
  tool catalog per category as a rail list (icon, name, description, arrow —
  not cards), searchable, each with a signature hover interaction (compare
  strip / scrub filmstrip / frequency bars) that echoes what that category's
  tools actually do. Clicking a tool opens its dedicated page rather than
  jumping straight to the editor.
- **Individual tool page** (`#page-tool`, one shared container rendered per
  tool via `openToolPage(id)`) — Persuade-then-Operate. Breadcrumb → H1 →
  description → a real upload workspace (drop a file here and it goes
  straight into the editor with that tool preselected) → formats → How It
  Works → Features → FAQ → Related Tools. Content is generated from real
  `TOOLS` data and true product facts, not per-tool copywriting or filler —
  see DESIGN.md for exactly what's generated vs. fixed.
- **Editor** (`#page-editor`) — Operate mode, the real workspace. Category
  rail (Video/Photo/Audio/AI Tools) → tool list → preview (drop zone / live
  preview / persistent transport bar for video / processing overlay, subtle
  technical grid) → settings panel → System Status. This is where every one
  of the ~34 real tools actually runs.

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
  placeholders — "Coming Soon" everywhere they appear (home page directory,
  and the editor's AI Tools rail entry).
- **Individual tool pages are built**, but without real per-tool URLs
  (`/video/trim`) — the product has no server, so routing is in-app only
  (`openToolPage(id)` swaps content and uses the same SPA page-switching
  every other page uses). If shareable/bookmarkable tool URLs matter later,
  that requires an actual hosting decision (a real static build/server), not
  a template change — see DESIGN.md.
- No genuine multi-track timeline (simultaneous video + audio + text tracks
  edited together) — the app's data model is one tool acting on one file. A
  real single-track video transport bar exists (filmstrip, play/pause, seek).
  Building an actual multi-track editor is a product decision (does Nexus
  Creator become a multi-track NLE?), not a visual one — flag to the user
  before attempting it.
- System Status shows Engine/Memory/Threads instead of literal CPU/GPU/RAM/
  VRAM, since browsers can't read the latter. If the user wants it to say
  CPU/GPU/RAM/VRAM anyway (accepting those are estimates, clearly labeled),
  that's a product call — ask first.
- No real zoom/pan on the editor canvas — a "ZOOM −100%+" control appears
  only in the home page's illustrative Editor Showcase section, not in the
  real editor, since there's no zoom functionality to back it.
- Responsive was verified at 390px (mobile) and 1440px (desktop) plus a full
  home-page scroll; tablet width (768-1024px) and the Photo/Audio category
  pages specifically were not independently screenshotted (they share the
  same template as Video, which was verified).
