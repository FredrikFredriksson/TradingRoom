-- Reset TradingRoom app tables to the public demo dataset.
-- This migration deletes existing app rows from trades, settings, and budget_transactions,
-- then seeds the sanitized demo state used by the hosted Vercel demo.

DO $$
DECLARE
  trades_exists BOOLEAN;
  settings_exists BOOLEAN;
  trades_has_user_id BOOLEAN;
  settings_has_user_id BOOLEAN;
  budget_exists BOOLEAN;
  demo_user_id UUID;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'trades'
  ) INTO trades_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'settings'
  ) INTO settings_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trades'
      AND column_name = 'user_id'
  ) INTO trades_has_user_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'settings'
      AND column_name = 'user_id'
  ) INTO settings_has_user_id;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'budget_transactions'
  ) INTO budget_exists;

  IF NOT trades_exists THEN
    RAISE EXCEPTION 'Expected public.trades to exist before running the demo reset.';
  END IF;

  IF NOT settings_exists THEN
    RAISE EXCEPTION 'Expected public.settings to exist before running the demo reset.';
  END IF;

  IF trades_has_user_id OR settings_has_user_id THEN
    SELECT id
    INTO demo_user_id
    FROM auth.users
    ORDER BY last_sign_in_at DESC NULLS LAST, created_at ASC
    LIMIT 1;

    IF demo_user_id IS NULL THEN
      RAISE EXCEPTION
        'Expected at least one auth.users record because trades/settings require user_id. Create a demo user or log in once, then rerun this migration.';
    END IF;
  END IF;

  IF budget_exists THEN
    DELETE FROM public.budget_transactions;
  END IF;

  DELETE FROM public.trades;
  DELETE FROM public.settings;

  IF settings_has_user_id THEN
    INSERT INTO public.settings (user_id, r_value, balance, default_leverage)
    VALUES (demo_user_id, 250.00, 12215.00, 5);
  ELSE
    INSERT INTO public.settings (r_value, balance, default_leverage)
    VALUES (250.00, 12215.00, 5);
  END IF;

  IF trades_has_user_id THEN
    INSERT INTO public.trades (
      user_id,
      symbol,
      type,
      open_price,
      stop_loss,
      take_profit,
      leverage,
      position_size,
      risk_amount,
      risk_multiple,
      open_date,
      close_price,
      close_date,
      status,
      pnl_percent,
      pnl_dollar,
      r_result,
      fee,
      notes
    )
    VALUES
      (demo_user_id, 'BTC/USDT', 'long', 96840, 95200, 99500, 5, 14500, 250, 1, '2026-03-12T09:15:00.000Z', NULL, NULL, 'open', NULL, NULL, NULL, 16.5, 'Breakout retest with room to scale only if momentum holds.'),
      (demo_user_id, 'ETH/USDT', 'short', 3342, 3410, 3210, 4, 9800, 375, 1.5, '2026-03-14T13:40:00.000Z', NULL, NULL, 'open', NULL, NULL, NULL, 11.2, 'Fade of range high into prior supply.'),
      (demo_user_id, 'SOL/USDT', 'long', 198.4, 191.5, 214.5, 6, 7200, 250, 1, '2026-03-17T10:05:00.000Z', NULL, NULL, 'open', NULL, NULL, NULL, 8.4, 'Pullback entry after reclaim of intraday VWAP.'),
      (demo_user_id, 'BTC/USDT', 'long', 94450, 93250, 97350, 4, 14250, 250, 1, '2026-01-08T08:45:00.000Z', 97200, '2026-01-10T14:20:00.000Z', 'closed', 2.91, 415, 1.66, 18.2, 'A+ continuation after daily reclaim.'),
      (demo_user_id, 'ETH/USDT', 'short', 3285, 3348, 3190, 3, 9680, 250, 1, '2026-01-14T11:05:00.000Z', 3190, '2026-01-15T18:35:00.000Z', 'closed', 2.89, 280, 1.12, 10.8, 'Clean rejection from resistance with broad market weakness.'),
      (demo_user_id, 'SOL/USDT', 'long', 196, 188, 211, 5, 6200, 250, 1, '2026-01-21T09:30:00.000Z', 188, '2026-01-22T15:10:00.000Z', 'closed', -4.08, -190, -0.76, 7.4, 'Stopped after momentum failed to expand.'),
      (demo_user_id, 'BTC/USDT', 'short', 101200, 102450, 98650, 4, 13100, 250, 1, '2026-02-03T12:10:00.000Z', 98650, '2026-02-04T19:25:00.000Z', 'closed', 2.52, 325, 1.3, 17.9, 'Momentum short into breakdown day.'),
      (demo_user_id, 'LINK/USDT', 'long', 24.6, 23.7, 26.1, 4, 3900, 250, 1, '2026-02-10T07:55:00.000Z', 23.8, '2026-02-11T16:00:00.000Z', 'closed', -3.25, -125, -0.5, 4.6, 'Quick invalidation after losing local structure.'),
      (demo_user_id, 'XRP/USDT', 'long', 2.31, 2.23, 2.56, 5, 5200, 250, 1, '2026-02-18T10:25:00.000Z', 2.54, '2026-02-19T21:30:00.000Z', 'closed', 9.96, 360, 1.44, 6.2, 'Continuation trade after strong relative strength.'),
      (demo_user_id, 'ADA/USDT', 'short', 0.87, 0.9, 0.84, 4, 4600, 250, 1, '2026-03-02T08:20:00.000Z', 0.84, '2026-03-03T17:45:00.000Z', 'closed', 3.45, 145, 0.58, 3.8, 'Short scalp back into range midpoint.'),
      (demo_user_id, 'SOL/USDT', 'long', 181, 173.5, 205, 5, 9800, 250, 1, '2026-03-05T09:50:00.000Z', 205, '2026-03-07T20:15:00.000Z', 'closed', 13.26, 505, 2.02, 9.7, 'Trend continuation into target after reclaim.');
  ELSE
    INSERT INTO public.trades (
      symbol,
      type,
      open_price,
      stop_loss,
      take_profit,
      leverage,
      position_size,
      risk_amount,
      risk_multiple,
      open_date,
      close_price,
      close_date,
      status,
      pnl_percent,
      pnl_dollar,
      r_result,
      fee,
      notes
    )
    VALUES
      ('BTC/USDT', 'long', 96840, 95200, 99500, 5, 14500, 250, 1, '2026-03-12T09:15:00.000Z', NULL, NULL, 'open', NULL, NULL, NULL, 16.5, 'Breakout retest with room to scale only if momentum holds.'),
      ('ETH/USDT', 'short', 3342, 3410, 3210, 4, 9800, 375, 1.5, '2026-03-14T13:40:00.000Z', NULL, NULL, 'open', NULL, NULL, NULL, 11.2, 'Fade of range high into prior supply.'),
      ('SOL/USDT', 'long', 198.4, 191.5, 214.5, 6, 7200, 250, 1, '2026-03-17T10:05:00.000Z', NULL, NULL, 'open', NULL, NULL, NULL, 8.4, 'Pullback entry after reclaim of intraday VWAP.'),
      ('BTC/USDT', 'long', 94450, 93250, 97350, 4, 14250, 250, 1, '2026-01-08T08:45:00.000Z', 97200, '2026-01-10T14:20:00.000Z', 'closed', 2.91, 415, 1.66, 18.2, 'A+ continuation after daily reclaim.'),
      ('ETH/USDT', 'short', 3285, 3348, 3190, 3, 9680, 250, 1, '2026-01-14T11:05:00.000Z', 3190, '2026-01-15T18:35:00.000Z', 'closed', 2.89, 280, 1.12, 10.8, 'Clean rejection from resistance with broad market weakness.'),
      ('SOL/USDT', 'long', 196, 188, 211, 5, 6200, 250, 1, '2026-01-21T09:30:00.000Z', 188, '2026-01-22T15:10:00.000Z', 'closed', -4.08, -190, -0.76, 7.4, 'Stopped after momentum failed to expand.'),
      ('BTC/USDT', 'short', 101200, 102450, 98650, 4, 13100, 250, 1, '2026-02-03T12:10:00.000Z', 98650, '2026-02-04T19:25:00.000Z', 'closed', 2.52, 325, 1.3, 17.9, 'Momentum short into breakdown day.'),
      ('LINK/USDT', 'long', 24.6, 23.7, 26.1, 4, 3900, 250, 1, '2026-02-10T07:55:00.000Z', 23.8, '2026-02-11T16:00:00.000Z', 'closed', -3.25, -125, -0.5, 4.6, 'Quick invalidation after losing local structure.'),
      ('XRP/USDT', 'long', 2.31, 2.23, 2.56, 5, 5200, 250, 1, '2026-02-18T10:25:00.000Z', 2.54, '2026-02-19T21:30:00.000Z', 'closed', 9.96, 360, 1.44, 6.2, 'Continuation trade after strong relative strength.'),
      ('ADA/USDT', 'short', 0.87, 0.9, 0.84, 4, 4600, 250, 1, '2026-03-02T08:20:00.000Z', 0.84, '2026-03-03T17:45:00.000Z', 'closed', 3.45, 145, 0.58, 3.8, 'Short scalp back into range midpoint.'),
      ('SOL/USDT', 'long', 181, 173.5, 205, 5, 9800, 250, 1, '2026-03-05T09:50:00.000Z', 205, '2026-03-07T20:15:00.000Z', 'closed', 13.26, 505, 2.02, 9.7, 'Trend continuation into target after reclaim.');
  END IF;
END $$;
