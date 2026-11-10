# AfterHours

A dark, anonymous-confession social frontend built with React, Vite, Tailwind CSS, React Router, Framer Motion, and Lucide icons.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

After signing in, the feed reads real records from Supabase. Creating a confession inserts it into the database so it remains after refresh. Reactions, comments, bookmarks, and notifications are not connected yet.

## Supabase setup

The supplied project URL and publishable key are configured in the ignored `.env.local`. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor to create the `confessions` table and Row Level Security policies. Configure your Supabase Auth email/redirect settings for local development and the deployed site. The client reads `id`, `content`, `category`, `created_at`, and `likes`. The author ID stays private and is never selected for the public feed.

## Deploy to GitHub Pages

The GitHub Actions workflow builds and deploys this Vite app to `https://aratamipizda.github.io/tellnojeffrey/` when changes are pushed to `main`. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. Add the Actions repository secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for sign-in and the persistent feed to work on the deployed site. These values are intentionally not committed to the repository. Add the deployed site URL to Supabase Auth's allowed site and redirect URLs.
