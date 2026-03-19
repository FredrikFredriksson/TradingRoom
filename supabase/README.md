# Supabase Maintenance

The public Vercel demo does not require Supabase, but this repo includes a data-reset migration so the remote project can be scrubbed and reseeded with the same sanitized sample trades shown in the app.

## What the migration does

- Deletes all rows from `trades`
- Deletes all rows from `settings`
- Deletes all rows from `budget_transactions` if that table exists
- Inserts the TradingRoom public demo settings and sample trades

If your `trades` and `settings` tables use `user_id`, the migration attaches the demo data to the most recently active auth user in `auth.users`.

## Run it

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

`supabase link` will prompt for the remote database password. You can find it in Supabase under Project Settings -> Database.

If the project has no auth users yet and your tables require `user_id`, create or sign into a user once before running the migration.
