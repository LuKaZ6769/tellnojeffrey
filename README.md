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

The supplied project URL and publishable key are configured in the ignored `.env.local`. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor to create the `confessions` table and Row Level Security policies. Configure your Supabase Auth email/redirect settings for `http://localhost:5173`. The client reads `id`, `content`, `category`, `created_at`, and `likes`. The author ID stays private and is never selected for the public feed.
