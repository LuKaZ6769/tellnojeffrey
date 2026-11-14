# SkyHop

A Flappy Bird-style game built with React and Vite. Tap or press Space/Up to fly through the pipes, then save your score to the leaderboard.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

The game is available at `/`. The original AfterHours community remains available at `/community`.

## Supabase setup

Set `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` in `.env.local`. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor to create the leaderboard table and its public read/submit policies (as well as the existing community schema). Only use a publishable/anon key in the browser; never put a service-role key in the frontend.

If Supabase is not configured, scores are saved locally in the current browser instead.

## Deploy to GitHub Pages

The GitHub Actions workflow builds and deploys this Vite app to `https://lukaz6769.github.io/tellnojeffrey/` when changes are pushed to `main`. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. Add the Actions repository secrets `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` for the online leaderboard to work on the deployed site. These values are intentionally not committed to the repository.
