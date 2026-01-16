# 🗄️ Supabase Setup Guide for TradingRoom

Follow these steps to connect your TradingRoom to Supabase for persistent cloud storage.

## Step 1: Create a Supabase Account & Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" and sign up (free tier available)
3. Click "New Project"
4. Give it a name (e.g., "TradingRoom")
5. Set a strong database password (save this somewhere safe!)
6. Choose a region close to you
7. Click "Create new project"

## Step 2: Create the Database Tables

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click "New query"
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste it into the SQL Editor
5. Click "Run" (or press Ctrl+Enter)

You should see "Success. No rows returned" which means the tables were created!

## Step 3: Get Your API Credentials

1. In Supabase, click **Project Settings** (gear icon at the bottom left)
2. Click **API** in the sidebar
3. You'll see:
   - **Project URL** - looks like `https://xxxxx.supabase.co`
   - **anon public** key - a long string starting with `eyJ...`

## Step 4: Configure TradingRoom

1. In your TradingRoom project folder, create a file called `.env`
2. Add these lines (replace with your actual values):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Save the file
4. Restart your development server:
```bash
npm run dev
```

## Step 5: Verify Connection

When you open TradingRoom, you should see:
- ✅ A green "Synced" indicator in the header
- ✅ No yellow warning about Supabase not being configured

## Troubleshooting

### "Supabase not configured" warning appears
- Make sure your `.env` file is in the project root (same folder as `package.json`)
- Make sure the environment variable names start with `VITE_`
- Restart the dev server after adding/changing the `.env` file

### Trades not saving
- Check the browser console (F12 → Console) for errors
- Make sure you ran the SQL schema in Supabase
- Check that Row Level Security policies were created

### Data not syncing
- Check your internet connection
- Verify your API keys are correct
- Look for errors in the Supabase dashboard → Logs

## Security Notes

- The `.env` file is already in `.gitignore` - your keys won't be pushed to Git
- The `anon` key is safe to use in client-side code
- For production, consider adding user authentication

## Importing Existing Data

If you have trades in localStorage that you want to import to Supabase:
1. Open browser DevTools (F12)
2. Go to Console
3. Run: `localStorage.getItem('tradingRoom_trades')`
4. This shows your existing trades data

To import to Supabase, you can either:
- Re-enter them through the app
- Use Supabase's Table Editor to paste JSON data

---

Need help? Check the [Supabase docs](https://supabase.com/docs) or open an issue!
