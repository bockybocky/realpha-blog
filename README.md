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

Comments use GitHub Discussions through giscus. The repo/category IDs are wired in `src/components/Giscus.astro`; Charles still needs to install the giscus GitHub App once at <https://github.com/apps/giscus>. Until then, the embedded comments area may show a giscus load/install error.

## New Post Flow

1. Add paired files under `src/content/blog/` using the same `slug` and `lang: zh-TW` or `lang: en`.
2. Keep `pubDate`, `description`, `tags`, and `category` filled.
3. Use `/blog/<slug>.md` and `/en/blog/<slug>.md` as the agent-readable Markdown URLs.
4. Run `npm run build` before publishing.

Articles are CC BY-NC-SA 4.0. Code is MIT.
