# Custom tool icons — drop-in folder

## Exact location

```
/Users/sami/Desktop/Tukesh/AI Project/Nexus Tools/.claude/worktrees/refactored-tickling-lagoon/icons/
```

That's this folder — the one this README is sitting in, inside the
`refactored-tickling-lagoon` worktree next to `Nexus Creator.html`. Save
your generated images directly under it, in the matching subfolder below.

Drop image files into the matching **segment/group** subfolder, named
**exactly** after the tool's `id` (case-sensitive, no spaces, extension
doesn't matter). That's the only rule — no manifest to edit, no code to
touch. Once files are in place, tell me and I'll run the build step that
pulls them into `Nexus Creator.html` and wires them into the dashboard
grids, category pages, and tool cards.

- Accepted formats: `.png`, `.webp`, `.jpg` / `.jpeg`, `.svg`
- Recommended: square, transparent background, ~256×256px (displayed at
  20–24px in grids today, but sized up for a future feature-showcase
  section and retina screens)
- You don't have to fill every row before I run the build — partial
  uploads are fine. Any tool without a file here just keeps its current
  built-in icon; nothing breaks, nothing looks unfinished.
- If you want one icon shared across segments (e.g. the same "Crop" glyph
  for video and photo), just save the same image under both ids.
- The build script scans every subfolder, so exact placement within a
  segment doesn't matter technically — the groups below are just to keep
  things organized while you're generating a lot of these at once.

## video/ — 15 tools, 4 groups

| Subfolder | Filename | Feature |
|---|---|---|
| `video/basic/` | `video-trim` | Trim — cut video to exact length |
| `video/basic/` | `video-crop` | Crop — trim to perfect frame |
| `video/basic/` | `video-resize` | Resize — change resolution |
| `video/basic/` | `video-rotate` | Rotate — rotate and flip video |
| `video/optimization/` | `video-compress` | Compress — reduce file size |
| `video/optimization/` | `video-convert` | Convert — MP4, WEBM, MOV, MKV |
| `video/optimization/` | `video-speed` | Speed — speed up or slow down |
| `video/optimization/` | `video-reverse` | Reverse — play video backwards |
| `video/optimization/` | `video-stabilize` | Stabilize — remove camera shake |
| `video/audio/` | `video-extract` | Extract Audio — pull audio out as MP3 |
| `video/audio/` | `video-noaudio` | Remove Audio — strip audio from video |
| `video/audio/` | `video-mute` | Mute — silence the audio track |
| `video/effects/` | `video-adjust` | Adjust — brightness & contrast |
| `video/effects/` | `video-vertical` | To Vertical — 9:16 for TikTok/Reels |
| `video/effects/` | `video-watermark` | Watermark — add text overlay |

## photo/ — 7 tools, 3 groups

| Subfolder | Filename | Feature |
|---|---|---|
| `photo/basic/` | `photo-crop` | Crop — trim to perfect frame |
| `photo/basic/` | `photo-resize` | Resize — scale to any dimension |
| `photo/basic/` | `photo-rotate` | Rotate — rotate by 90/180/270° |
| `photo/optimization/` | `photo-compress` | Compress — reduce without losing quality |
| `photo/optimization/` | `photo-convert` | Convert — JPG, PNG, WEBP formats |
| `photo/effects/` | `photo-effects` | Effects — brightness, contrast, filters |
| `photo/effects/` | `photo-watermark` | Watermark — text or image overlay |

## audio/ — 10 tools, 3 groups

| Subfolder | Filename | Feature |
|---|---|---|
| `audio/basic/` | `audio-trim` | Trim — cut to exact timing |
| `audio/basic/` | `audio-volume` | Volume — boost or reduce volume |
| `audio/basic/` | `audio-fade` | Fade — fade in & fade out |
| `audio/optimization/` | `audio-convert` | Convert — MP3, WAV, AAC, FLAC |
| `audio/optimization/` | `audio-compress` | Compress — reduce audio file size |
| `audio/optimization/` | `audio-normalize` | Normalize — auto-level loudness |
| `audio/optimization/` | `audio-mono` | Mono — stereo to mono mix-down |
| `audio/effects/` | `audio-speed` | Speed — speed up or slow down |
| `audio/effects/` | `audio-reverse` | Reverse — play audio backwards |
| `audio/effects/` | `audio-pitch` | Pitch — shift pitch ±12 semitones |

## ai/ — 4 tools, cross-category, flat (no subfolders)

| Filename | Feature |
|---|---|
| `ai-removebg` | Remove BG — AI background removal |
| `ai-upscale` | Upscale 4× — AI resolution boost |
| `ai-subtitle` | Auto Subtitle — generate accurate subtitles |
| `ai-denoise` | Noise Removal — remove background noise |

---

Example: the icon for Video → Basic → Trim goes at
`icons/video/basic/video-trim.png`.

Once you've dropped files in, run:

```
node icons/build.mjs
```

from the worktree root — it embeds whatever it finds and reports what's
still missing.
