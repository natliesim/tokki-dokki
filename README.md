# Tokki Dokki

**Play it:** https://natliesim.github.io/tokki-dokki/

A small browser game drawn like a notebook doodle: help the bunny hop up the page and climb as high as you can.

- **Move:** ← → or A / D (on a phone, tap the left or right side)
- **Start / restart:** Space or tap
- Solid ledges are safe, highlighted ones slide, dashed ones break, and red springs launch you higher.
- **Ink blobs** float side to side: land on top to squash one, but touching one any other way ends your run.
- **It gets harder as you climb:** every 250 points the game quietly speeds up (up to 42% faster), with more sliding ledges, breakable traps and ink blobs. A solid ledge is always within reach.
- **Mute:** the speaker icon or the M key. Sounds are generated in code, no audio files.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints. `npm run build` makes a static site in `dist/`.

Every push to `main` rebuilds the game and publishes it to GitHub Pages (see `.github/workflows/deploy.yml`).

## High score board

Scores are shared through a free [Supabase](https://supabase.com) database. The board stays hidden until it's connected.

1. Create a free Supabase project.
2. In the project, open **SQL Editor**, paste in `supabase/setup.sql`, and click **Run**. This creates the scores table and its rules: anyone can read scores and add one, nobody can edit or delete them.
3. Put the project URL and the **publishable** key (Project Settings → API Keys) into `src/config.js`. Both are safe to make public. Never use the secret / `service_role` key.

The game checks that names are 1–12 characters and scores between 1 and 100,000. As in any browser game, a determined player could still send a fake score, so you may occasionally want to delete odd entries in Supabase's Table Editor.
