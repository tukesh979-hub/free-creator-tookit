# Custom tool icons — drop-in folder

Drop image files into the matching subfolder below, named **exactly** after
the tool's `id` (case-sensitive, no spaces). That's the only rule — no
manifest to edit, no code to touch. Once files are in place, tell me and
I'll run the build step that pulls them into `Nexus Creator.html` and wires
them into the dashboard grids, category pages, and tool cards.

- Accepted formats: `.png`, `.webp`, `.jpg` / `.jpeg`, `.svg`
- Recommended: square, transparent background, ~256×256px (displayed at
  20–24px in grids today, but sized up for a future feature-showcase
  section and retina screens)
- You don't have to fill every row before I run the build — partial
  uploads are fine. Any tool without a file here just keeps its current
  built-in icon; nothing breaks, nothing looks unfinished.
- If you want one icon shared across segments (e.g. the same "Crop" glyph
  for video and photo), just save the same image under both ids.

## video/ (15 tools)

| Filename (any supported extension) | Feature |
|---|---|
| `video-trim` | Trim — cut video to exact length |
| `video-crop` | Crop — trim to perfect frame |
| `video-resize` | Resize — change resolution |
| `video-rotate` | Rotate — rotate and flip video |
| `video-compress` | Compress — reduce file size |
| `video-convert` | Convert — MP4, WEBM, MOV, MKV |
| `video-speed` | Speed — speed up or slow down |
| `video-reverse` | Reverse — play video backwards |
| `video-stabilize` | Stabilize — remove camera shake |
| `video-extract` | Extract Audio — pull audio out as MP3 |
| `video-noaudio` | Remove Audio — strip audio from video |
| `video-mute` | Mute — silence the audio track |
| `video-adjust` | Adjust — brightness & contrast |
| `video-vertical` | To Vertical — 9:16 for TikTok/Reels |
| `video-watermark` | Watermark — add text overlay |

## photo/ (7 tools)

| Filename | Feature |
|---|---|
| `photo-crop` | Crop — trim to perfect frame |
| `photo-resize` | Resize — scale to any dimension |
| `photo-rotate` | Rotate — rotate by 90/180/270° |
| `photo-compress` | Compress — reduce without losing quality |
| `photo-convert` | Convert — JPG, PNG, WEBP formats |
| `photo-effects` | Effects — brightness, contrast, filters |
| `photo-watermark` | Watermark — text or image overlay |

## audio/ (10 tools)

| Filename | Feature |
|---|---|
| `audio-trim` | Trim — cut to exact timing |
| `audio-volume` | Volume — boost or reduce volume |
| `audio-fade` | Fade — fade in & fade out |
| `audio-convert` | Convert — MP3, WAV, AAC, FLAC |
| `audio-compress` | Compress — reduce audio file size |
| `audio-normalize` | Normalize — auto-level loudness |
| `audio-speed` | Speed — speed up or slow down |
| `audio-reverse` | Reverse — play audio backwards |
| `audio-pitch` | Pitch — shift pitch ±12 semitones |
| `audio-mono` | Mono — stereo to mono mix-down |

## ai/ (4 tools — cross-category)

| Filename | Feature |
|---|---|
| `ai-removebg` | Remove BG — AI background removal |
| `ai-upscale` | Upscale 4× — AI resolution boost |
| `ai-subtitle` | Auto Subtitle — generate accurate subtitles |
| `ai-denoise` | Noise Removal — remove background noise |

---

Example: the icon for Video → Trim goes at `icons/video/video-trim.png`.
