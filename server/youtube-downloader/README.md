# Nexus Creator — YouTube Downloader backend

This is the server behind the "Downloader" page in Nexus Creator. It is
**not** part of the static site, and **the intended way to use it is
locally, on your own machine** — `YTDL_API_BASE` in `Nexus Creator.html`
points at `http://localhost:8787` by design, not at any shared or hosted
instance. There is no central server to sign up for or pay for: every
visitor who wants the Downloader page working runs this themselves. The
"Deploying it for real" section further down exists for anyone who
wants a public URL anyway, but that's optional, not the default path.

## Why this can't just run in the browser

Every other tool in Nexus Creator runs entirely client-side (FFmpeg.wasm,
no uploads, nothing leaves your device). YouTube downloading can't work
that way for two reasons that have nothing to do with this codebase:

1. YouTube's video CDN doesn't allow arbitrary web pages to fetch its
   video streams cross-origin — that request has to come from a server.
2. As of 2026, YouTube also blocks non-browser traffic behind a
   "Sign in to confirm you're not a bot" wall unless the request looks
   like it's coming from one of YouTube's own apps.

So a real server is unavoidable here. This is that server — a thin
wrapper around [yt-dlp](https://github.com/yt-dlp/yt-dlp) (the actively
maintained engine literally every other YouTube-downloader project uses
under the hood, including all the ones referenced when this was built)
and `ffmpeg` for merging/trimming.

## Requirements

- Node.js 18+
- [`yt-dlp`](https://github.com/yt-dlp/yt-dlp#installation) installed and on `PATH`
- `ffmpeg` installed and on `PATH`

Check both are available:
```bash
yt-dlp --version
ffmpeg -version
```

## Run locally

```bash
cd server/youtube-downloader
npm install
npm start
# Nexus YouTube Downloader backend listening on http://localhost:8787
```

Then in `Nexus Creator.html`, find the `YTDL_API_BASE` constant near the
Downloader page's script and confirm it points at `http://localhost:8787`
(that's the default). Open the site, go to Downloader — it should show
"Connected" instead of the not-connected empty state.

## Deploying it for real

Vercel (which hosts the static site) can't run this — it needs
`yt-dlp`/`ffmpeg` as real binaries and downloads can run longer than a
serverless function is allowed to. Options that work well for a small
Node service like this:

- **Railway** or **Render** — easiest path. Both support a
  `Dockerfile`/buildpack that installs `yt-dlp` + `ffmpeg`, both have a
  generous free/low-cost tier, both give you a public HTTPS URL.
- **Fly.io** — similar, a bit more manual (you write the Dockerfile
  yourself), more control over region/resources.
- **Your own VPS** — most control, most maintenance. `apt install
  ffmpeg`, install `yt-dlp` via pip/pipx, run this with `pm2` or a
  systemd unit, put it behind Caddy/nginx for HTTPS.

Whichever you pick: once it's live at a public URL, update
`YTDL_API_BASE` in `Nexus Creator.html` to that URL and redeploy the
site.

### A minimal Dockerfile (Railway/Render/Fly all accept this)

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg python3-pip curl \
  && pip3 install --break-system-packages -U yt-dlp \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.js"]
```

## Configuration

Environment variables (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `MAX_DURATION_SECONDS` | `14400` (4h) | Longest *untrimmed* video this server will fully download. Trimmed downloads are only checked against the length of the trim itself, not the source video. |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | How many downloads run at once before new requests get a 429 |

## Keeping it working

YouTube changes how it detects non-browser traffic periodically. When
that happens, downloads will start failing with bot-check errors again.
The fix is almost always: `pip install -U yt-dlp` (or however you
installed it) to pick up yt-dlp's latest workaround — the project
updates very frequently specifically because of this cat-and-mouse
dynamic. If a version bump alone doesn't fix it, check
[the yt-dlp wiki's YouTube extractor notes](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube)
for the current recommended `--extractor-args`, and update
`YTDLP_BASE_ARGS` in `server.js` to match.

## Legal

- `yt-dlp` itself is legal, open-source software — there's nothing
  questionable about running it.
- Downloading a video you don't have rights to, and don't have
  permission for, is a separate question — YouTube's Terms of Service
  generally prohibit downloading content without the uploader's
  permission or a feature (like the offline-download button) that
  explicitly allows it, and copyright law applies regardless of ToS.
- This tool is meant for content you have the rights to: your own
  uploads, Creative Commons / public-domain videos, content the
  uploader has explicitly permitted downloading of, or anywhere else
  local law and the platform's terms actually allow it.
- If you deploy this publicly (not just for your own local use), you
  are the one operating a service that can download third-party
  copyrighted content at scale — that carries real takedown/ToS
  exposure that a purely local/personal install doesn't. Worth deciding
  deliberately, not by default.
