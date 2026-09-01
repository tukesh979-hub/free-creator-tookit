# Nexus Creator — YouTube Downloader backend

This is the server behind the "Downloader" page in Nexus Creator. It is
**not** part of the static site — it's a separate small Node service that
`Nexus Creator.html` talks to over HTTP.

**How the live site uses this:** the frontend tries an ordered list of
backends (`YTDL_BACKENDS` in `Nexus Creator.html`) and uses whichever
answers first — normally two independent free-tier hosted instances
(Oracle Cloud as primary, Render as backup, so one being asleep or briefly
down doesn't take the feature down for every visitor), falling back to
`http://localhost:8787` last, for anyone deliberately running their own
copy. **There's no cost to you as a visitor either way** — nothing here
requires a sign-up or payment to *use*; the cost question only applies to
whoever operates the hosted instances.

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

## Run it locally

```bash
cd server/youtube-downloader
npm install
npm start
# Nexus YouTube Downloader backend listening on http://localhost:8787
```

`http://localhost:8787` is already the last entry in `YTDL_BACKENDS` in
`Nexus Creator.html`, so nothing else needs to change — open the site, go
to Downloader, and once the two hosted candidates ahead of it don't
answer (or you comment them out for local dev), it falls through to
yours automatically.

## Deploying for real redundancy (Oracle + Render)

**⚠️ HTTPS is mandatory, not optional.** The live site is served over
`https://`, and browsers silently block a `fetch()` from an `https://`
page to a plain `http://` backend as mixed content — no error message,
it just looks exactly like "the backend is down." Render gives you HTTPS
automatically. Oracle is a bare VM with none by default — the Cloudflare
Tunnel step below solves that without buying a domain or managing certs
yourself.

### Render (do this one first — it's the easy one)

1. Push this repo to your own GitHub (or use the existing one).
2. In the [Render dashboard](https://dashboard.render.com/): **New >
   Blueprint**, point it at the repo — Render finds `render.yaml` in
   this folder automatically and proposes the service. Or skip the
   Blueprint and do **New > Web Service** manually, pointing it at
   `server/youtube-downloader/Dockerfile`.
3. Pick the **Free** plan. Deploy.
4. Once it's live, Render gives you a URL like
   `https://nexus-youtube-downloader.onrender.com` — that's already
   `https://`, no extra setup.
5. Confirm it works: `curl https://<your-app>.onrender.com/api/health`
   should return `{"ok":true,...}`.

Known limits on the free plan: sleeps after 15 minutes idle (the next
request pays a ~30-60s cold-start delay), 512MB RAM (a very demanding
job — a long "Best available" 4K trim — could theoretically hit that
ceiling; `MAX_CONCURRENT_DOWNLOADS` is set to `2` in `render.yaml`
specifically to leave more headroom per job than the default `3`).

### Oracle Cloud "Always Free" (do this second — more setup, but a real always-on server with generous bandwidth)

1. Create an [Oracle Cloud account](https://www.oracle.com/cloud/free/).
   Fair warning: signup can be genuinely annoying — card verification
   holds, and the free Ampere A1 shape sometimes reports "out of
   capacity" in busy regions (retrying, or trying a different region,
   usually works eventually).
2. Create a VM: **Compute > Instances > Create Instance**. Choose the
   **Ampere (ARM) A1** shape (this is the Always Free one — as of mid-2026
   it's 2 OCPUs / 12GB RAM, plenty for this). Ubuntu is a fine image
   choice. Save the SSH key it gives you.
3. SSH in, then install Docker:
   ```bash
   ssh -i your-key.pem ubuntu@<instance-public-ip>
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   # log out and back in for the group change to take effect
   ```
4. Clone this repo and build+run the container:
   ```bash
   git clone https://github.com/tukesh979-hub/free-creator-tookit.git
   cd free-creator-tookit/server/youtube-downloader
   docker build -t nexus-ytdl .
   docker run -d --restart unless-stopped -p 8787:8787 --name nexus-ytdl nexus-ytdl
   ```
5. **Get HTTPS via Cloudflare Tunnel** (free, no domain purchase, no
   firewall port to open on the VM):
   ```bash
   curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
   sudo dpkg -i cloudflared.deb
   cloudflared tunnel --url http://localhost:8787
   ```
   This prints a `https://<random-name>.trycloudflare.com` URL that
   proxies straight to your container — that's the URL to use. It's
   temporary (dies if the command stops); for a stable one, `cloudflared
   tunnel login` and follow [Cloudflare's named-tunnel
   docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/create-remote-tunnel/)
   to get a permanent subdomain (still free, just needs a Cloudflare
   account — doesn't require owning a domain if you use one of theirs,
   or point an existing domain's nameservers at Cloudflare if you have one).
6. To survive VM reboots, run the tunnel as a service too:
   ```bash
   sudo cloudflared service install
   ```
7. Confirm: `curl https://<your-tunnel-url>/api/health`.

### Wiring both into the frontend

Once you have both URLs, edit `YTDL_BACKENDS` near the top of the
Downloader script in `Nexus Creator.html`:

```js
const YTDL_BACKENDS = [
  'https://<your-tunnel-name>.trycloudflare.com', // Oracle, via Cloudflare Tunnel
  'https://<your-app>.onrender.com',              // Render
  'http://localhost:8787',                        // local fallback, unchanged
];
```

Order matters — the first one that answers `/api/health` wins for that
visitor's session. Oracle is listed first since it has more RAM and
never sleeps; Render second as the backup; localhost last, for anyone
deliberately self-hosting.

## Configuration

Environment variables (all optional):

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8787` | Port to listen on |
| `MAX_DURATION_SECONDS` | `14400` (4h) | Longest *untrimmed* video this server will fully download. Trimmed downloads are only checked against the length of the trim itself, not the source video. |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | How many downloads run at once before new requests get a 429 (Render's `render.yaml` overrides this to `2`, given its smaller RAM allowance) |

## Keeping it working

YouTube changes how it detects non-browser traffic periodically. When
that happens, downloads will start failing with bot-check errors again.
The fix is almost always: `pip install -U yt-dlp` (or however you
installed it) to pick up yt-dlp's latest workaround — the project
updates very frequently specifically because of this cat-and-mouse
dynamic. If a version bump alone doesn't fix it, check
[the yt-dlp wiki's YouTube extractor notes](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube)
for the current recommended `--extractor-args`, and update
`YTDLP_BASE_ARGS` in `server.js` to match. If you're running the Docker
image, rebuild it after bumping the pinned `yt-dlp` version.

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
- Running hosted instances that visitors use (not just your own local
  install) means you're operating a service that can download
  third-party copyrighted content at scale — that carries real
  takedown/ToS exposure that a purely local/personal install doesn't.
  Worth having accepted that deliberately, which is exactly what
  deploying Oracle + Render here means doing.
