# Clocked

A shared countdown for an agreement where work paid in US dollars reduces a debt in pounds.

## Sign-in and storage

Abdul and Halimah have separate name-and-PIN sign-ins. A successful sign-in creates a signed, HttpOnly browser cookie that lasts up to 30 days. Closing the browser does not end the sign-in. Clearing browser data removes the cookie, so the person must sign in again.

The agreement, saved sessions, active timer, archives and display settings are held in the shared Supabase project's `clocked_state` table. Both sign-ins see the same records. The `clocked_sign_in_failures` table limits repeated PIN attempts. The browser never receives the Supabase service key or stored PINs. Server writes use a version check, so a stale tab cannot silently replace another device's change. A failed write keeps the form or frozen timer available to retry.

Existing records from the old browser-only version can be imported once from the same browser when the shared database is empty. Import them before clearing that browser's data. Records already in Supabase survive a browser close or cache reset. Records can also be exported as JSON from Settings → Records.

## Deploy

Apply the files in `supabase/migrations` in order in the chosen Supabase project. Configure these Vercel Production environment variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access |
| `CLOCKED_SESSION_SECRET` | Random secret of at least 32 characters for signed cookies |
| `CLOCKED_PIN_ABDUL` | Abdul's PIN |
| `CLOCKED_PIN_HALIMAH` | Halimah's PIN |

The two database tables have row-level security enabled and no public access policies. Keep all five values out of Git and browser code.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

`npm run dev` serves the interface; the `/api` functions require Vercel or an equivalent local server with the environment variables above.

## Accounting

Each saved session keeps its hourly USD rate and GBP-per-USD rate. Later rate changes apply to future work. Older records without an hourly-rate snapshot retain their saved USD and GBP values. Credit is kept to eight decimal places internally, with pennies rounded only for display. Arbitrary splits can differ by up to the chosen eight-decimal rounding unit; the tests cover that policy. A positive balance below a penny is still shown as owing.

The active timer is stored remotely. Closing or refreshing the browser while it is running preserves its timestamp; elapsed time catches up when Clocked opens again. Pauses and saves are confirmed by the server before they appear committed.
