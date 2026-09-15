# Realpha Blog

Astro bilingual blog for Realpha, Bocky, and the AI research team. Phase A follows [BLOG_MASTER_SPEC.md](./BLOG_MASTER_SPEC.md): static content, zh-TW at the root, English under `/en/`, SEO and agent-readable outputs, and lab demos with copyable source.

## Project Structure

```text
src/
  components/        Shared Astro components
  content/           Blog, lab, and projects collections
  layouts/           Site shell and article layout
  lib/               Site constants and collection helpers
  pages/             Static routes, RSS, and Markdown endpoints
  styles/            Global CSS
public/
  copy-code.js       Vanilla copy buttons
  lab-demos.js       Shared canvas and SVG demo code
  robots.txt         Search and agent crawler policy
scripts/
  postbuild.mjs      Generates llms.txt and llms-full.txt
  serve_dist.mjs     Zero-dependency localhost server for dist/
```

## Commands

```bash
npm run dev
npm run build
npm run preview
node scripts/serve_dist.mjs
```

`npm run build` runs `astro build` and then generates `dist/llms.txt` plus `dist/llms-full.txt`.

## Local Static Service

Production serving on this machine is `node scripts/serve_dist.mjs`, bound only to `127.0.0.1:8377`. The Windows startup task is `RealphaBlogServe`.

Update flow: edit content -> `npm run build` -> the service reads the refreshed `dist/` files directly, no restart needed.

Comments use GitHub Discussions through giscus. The repo/category IDs are wired in `src/components/Giscus.astro`; The giscus GitHub App is installed (verified 2026-08-23: pages load `giscus.app/client.js`; no discussions yet because no one has commented). Only if the comments area shows an install error does it need reinstalling.

## New Post Flow

1. Add paired files under `src/content/blog/` using the same `slug` and `lang: zh-TW` or `lang: en`.
2. Keep `pubDate`, `description`, `tags`, and `category` filled.
3. Use `/blog/<slug>.md` and `/en/blog/<slug>.md` as the agent-readable Markdown URLs.
4. Run `npm run build` before publishing.

## Audio Articles (有聲文章)

1. Drop `public/audio/<slug>.mp3` (Chinese) or `public/audio/<slug>.en.mp3` (English). The folder is gitignored like `public/covers/`.
2. `npm run build` runs `scripts/audio_manifest.mjs`, which maps files to published posts and writes `src/data/audio.json` (gitignored, measured with `ffprobe`; missing ffprobe only leaves `seconds` empty).
3. Posts with audio get a player under the title, a 🎧 badge on cards, the home "可收聽" tab, and an episode in `/podcast.xml` (Chinese only). English pages only show English audio.
4. Frontmatter `audio` / `audioDuration` / `audioBytes` override the manifest manually.

Known gaps: `itunes:image` uses `/favicon-512.png` because the site has no square cover of 1400px or more (Apple Podcasts requires 1400–3000px); there is no `itunes:owner` email. Both are needed before submitting to Apple Podcasts.

Articles are CC BY-NC-SA 4.0. Code is MIT.
