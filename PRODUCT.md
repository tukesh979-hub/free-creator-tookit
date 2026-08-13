# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday quick-edit users: someone who needs to trim a clip, crop a photo, convert a file format, or make a similar one-off edit right now. Casual, task-driven use — not a daily-driver creative professional workflow. They arrive knowing exactly what they want to do and want to reach it in seconds, with zero setup.

## Product Purpose

A free, all-in-one browser-based toolkit for editing photos, video, and audio. Everything runs client-side — photo processing via the Canvas API, video/audio via FFmpeg.wasm — so no file ever leaves the user's device. No signup, no watermark, no artificial limits. Success is the user completing their one task and leaving satisfied, without friction.

## Positioning

Unlike Kapwing/CloudConvert/Canva-style tools that require an account, upload files to a server, add a watermark, or gate features behind a paywall, this toolkit processes everything locally in the browser: nothing uploads, nothing to sign up for, nothing paywalled.

## Operating Context

Currently a single static HTML file with no build step or framework, opened directly or (per the stated direction) hosted publicly. Video/audio tools depend on FFmpeg.wasm, which requires COOP/COEP response headers from whatever serves the file in production — without them, video/audio processing is disabled (photo-only mode). FFmpeg.wasm is a ~30MB first-load fetched from a CDN.

## Capabilities and Constraints

34 working tools across three categories: 15 video (trim, crop, resize, rotate, compress, convert, speed, reverse, stabilize, extract audio, mute, adjust, vertical reformat, watermark), 7 photo (crop, resize, rotate, compress, convert, effects, watermark), 8 audio (trim, volume, fade, convert, compress, normalize, speed, reverse). Plus 4 AI tools currently placeholders ("Coming Phase 2": background removal, upscale, subtitle generation, denoise — planned via Transformers.js, in-browser). No accounts, no server-side storage of any kind.

## Brand Commitments

None. The user explicitly confirmed nothing is fixed for this redesign — name, colors, and visual identity are all open. The working title shown on the current page ("FREE CREATOR TOOLKIT") and the file's working name ("Nexus") are not locked; treat as replaceable unless the user says otherwise during the redesign.

## Evidence on Hand

No real user testimonials, customer logos, usage stats, or case studies exist — this is a utility, not a marketing site with third-party claims. Any social proof, numbers, or testimonials in the new design must be clearly synthetic/placeholder, never presented as real.

## Product Principles

1. Zero friction — no signup, no install, no waiting on an upload.
2. Privacy by default — nothing leaves the user's device; this is a real technical property, not just messaging.
3. Free and unlimited — no paywalls, no watermarks, no artificial caps.
4. Task-first — the user already knows what they want to do; the fastest path to that tool wins over exploration or storytelling.
5. Credible as a public product — since this is headed toward public hosting, the redesign needs to read as a trustworthy, finished product, not a hobby page.
