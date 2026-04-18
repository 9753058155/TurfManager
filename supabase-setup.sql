-- ============================================================
-- TURFZONE — SUPABASE SQL SETUP (FIXED)
-- Correct table names: bookings, profiles, slot_fees, tournament_board
-- ============================================================

-- ============================================================
-- STEP 1: ADD MISSING COLUMNS TO bookings
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='status') THEN
    ALTER TABLE bookings ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='razorpay_order_id') THEN
    ALTER TABLE bookings ADD COLUMN razorpay_order_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='payment_id') THEN
    ALTER TABLE bookings ADD COLUMN payment_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='qr_used') THEN
    ALTER TABLE bookings ADD COLUMN qr_used BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='amount') THEN
    ALTER TABLE bookings ADD COLUMN amount INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='date') THEN
    ALTER TABLE bookings ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='start_time') THEN
    ALTER TABLE bookings ADD COLUMN start_time TEXT NOT NULL DEFAULT '06:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='end_time') THEN
    ALTER TABLE bookings ADD COLUMN end_time TEXT NOT NULL DEFAULT '07:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='user_id') THEN
    ALTER TABLE bookings ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='created_at') THEN
    ALTER TABLE bookings ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================================
-- STEP 2: ADD MISSING COLUMNS TO profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='wallet_balance') THEN
    ALTER TABLE profiles ADD COLUMN wallet_balance INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name') THEN
    ALTER TABLE profiles ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
    ALTER TABLE profiles ADD COLUMN phone TEXT;
  END IF;
END $$;

-- ============================================================
-- STEP 3: ADD MISSING COLUMNS TO slot_fees
-- (your table already has: slot_time, price, created_at)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='slot_fees' AND column_name='slot_type') THEN
    ALTER TABLE slot_fees ADD COLUMN slot_type TEXT DEFAULT 'day';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='slot_fees' AND column_name='duration_minutes') THEN
    ALTER TABLE slot_fees ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 60;
  END IF;
END $$;

-- ============================================================
-- STEP 4: SEED slot_fees (one row per hour, includes slot_time)
-- ============================================================
INSERT INTO slot_fees (slot_time, price, duration_minutes, slot_type)
SELECT unnest(ARRAY['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'])::TEXT AS slot_time,
       500 AS price, 60 AS duration_minutes, 'day' AS slot_type
WHERE NOT EXISTS (SELECT 1 FROM slot_fees LIMIT 1);

INSERT INTO slot_fees (slot_time, price, duration_minutes, slot_type)
SELECT unnest(ARRAY['18:00','19:00','20:00','21:00'])::TEXT AS slot_time,
       700 AS price, 60 AS duration_minutes, 'night' AS slot_type
WHERE NOT EXISTS (SELECT 1 FROM slot_fees WHERE slot_type = 'night');

-- ============================================================
-- STEP 5: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings(date);
CREATE INDEX IF NOT EXISTS idx_bookings_user   ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_order  ON bookings(razorpay_order_id);

-- ============================================================
-- STEP 6: PREVENT DOUBLE BOOKING
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_slot
  ON bookings(date, start_time)
  WHERE status IN ('confirmed', 'pending');

-- ============================================================
-- STEP 7: REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE bookings;

-- ============================================================
-- STEP 8: ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE bookings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "bookings_select_own" ON bookings;
CREATE POLICY "bookings_select_own" ON bookings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bookings_insert_own" ON bookings;
CREATE POLICY "bookings_insert_own" ON bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "slot_fees_public_read" ON slot_fees;
CREATE POLICY "slot_fees_public_read" ON slot_fees
  FOR SELECT USING (true);

-- ============================================================
-- DONE! Now make yourself admin (replace email):
-- UPDATE profiles SET role = 'admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
-- ============================================================

-- ============================================================
-- ADDITIONAL: Allow service role to update slot_fees
-- (Admin pricing updates go through /api/update-fee which uses
--  the service role key — so no extra policy needed there.
--  But if you want admins to also update via anon key directly:)
-- ============================================================

-- Allow bookings to be updated by service role (webhooks, release, cancel)
DROP POLICY IF EXISTS "bookings_update_service" ON bookings;
CREATE POLICY "bookings_update_service" ON bookings
  FOR UPDATE USING (true);  -- service role bypasses RLS anyway

-- Allow profiles to be updated by service role (wallet refunds)
DROP POLICY IF EXISTS "profiles_update_service" ON profiles;
CREATE POLICY "profiles_update_service" ON profiles
  FOR UPDATE USING (true);
