# 🏟️ TurfZone — Setup Guide

## Project Structure
```
app/
  page.tsx           ← Home + slot booking grid
  auth/page.tsx      ← Login / Signup
  book/page.tsx      ← My Bookings list
  booking/[id]/      ← Booking detail + QR code
  admin/page.tsx     ← Admin dashboard
  scan/page.tsx      ← QR entry verification
  api/
    create-order/    ← Creates Razorpay order + booking
    webhook/         ← Razorpay webhook (confirms payment)
    cancel-booking/  ← Cancel + wallet refund
    verify-qr/       ← Generate + verify QR codes
components/
  Nav.tsx, Toast.tsx, BookingModal.tsx
lib/supabase.ts      ← Supabase client
```

---

## Step 1 — Run SQL in Supabase

1. Go to [supabase.com](https://supabase.com) → your project
2. Click **SQL Editor** in sidebar
3. Paste and run the entire contents of `supabase-setup.sql`
4. This adds required columns to your existing tables safely

---

## Step 2 — Get Your Keys

### Supabase Service Role Key
1. Supabase → Settings → API
2. Copy **service_role** key (starts with `eyJ...`)
3. **Never expose this in frontend**

### Razorpay Keys
1. Go to [razorpay.com](https://razorpay.com) → Settings → API Keys
2. Generate test keys
3. Copy **Key ID** and **Key Secret**

---

## Step 3 — Create `.env.local`

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://cejzlpkufrlllryhdpfp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_WuNHl13l7ocsVxZMDD-w2A_LtBdNBB2
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_service_role_key

RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxx

QR_SECRET=any-random-string-minimum-32-characters-long

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 4 — Install & Run

```bash
npm install
npm run dev
```

Visit: http://localhost:3000

---

## Step 5 — Make Yourself Admin

After creating an account via the app:

1. Supabase → SQL Editor → run:
```sql
UPDATE profile SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

2. Refresh the app — you'll see **Admin** link in navbar

---

## Step 6 — Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Then in Vercel dashboard → Settings → Environment Variables → add all variables from `.env.local`

### Set Razorpay Webhook URL
1. Razorpay Dashboard → Settings → Webhooks → Add New
2. URL: `https://your-vercel-url.vercel.app/api/webhook`
3. Events to select: `payment.captured`, `payment.failed`
4. Secret: same as `RAZORPAY_KEY_SECRET`

---

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Home — slot grid, book here |
| `/auth` | Login / Sign up |
| `/book` | My bookings list |
| `/booking/[id]` | Booking detail + QR code |
| `/admin` | Admin dashboard (admin role only) |
| `/scan` | QR entry scanner (admin use) |

---

## How Booking Flow Works

```
User picks slot → BookingModal → /api/create-order
  → Razorpay checkout opens
  → User pays
  → Razorpay calls /api/webhook (source of truth)
  → Booking confirmed in DB
  → User lands on /booking/[id] with QR
```

---

## What Each Table Needs (minimum columns)

### `booking`
| Column | Type |
|--------|------|
| id | uuid (PK) |
| user_id | uuid |
| date | date |
| start_time | text |
| end_time | text |
| amount | integer |
| status | text (pending/confirmed/cancelled) |
| razorpay_order_id | text |
| payment_id | text |
| qr_used | boolean |
| created_at | timestamptz |

### `profile`
| Column | Type |
|--------|------|
| id | uuid (PK, = auth.users.id) |
| full_name | text |
| phone | text |
| wallet_balance | integer |
| role | text (user/admin) |

### `slot_fees`
| Column | Type |
|--------|------|
| id | uuid (PK) |
| slot_type | text (day/night) |
| price | integer |
| duration_minutes | integer |

---

## Testing Razorpay (Test Mode)

Use card: `4111 1111 1111 1111`, any future date, any CVV
Or UPI: `success@razorpay`
