# 🚗 CarCost

A simple, mobile-first web app to track maintenance and fuel costs across all your
cars. Built for a single user (you), password-protected, and hosted on Vercel.

<!-- Deployed automatically from main via Vercel's GitHub integration. -->


## Features

- **Multiple cars** — add as many as you want, switch between them easily.
- **Maintenance log** — record either:
  - **DIY** jobs with a line-item list of parts/items you bought (oil, filters, etc.), plus optional labor/other cost, or
  - **Dealer / shop** visits as a single lump sum with the shop name.
- **Service reminders** — define services per car with a mileage and/or time
  interval (e.g. *Oil change every 5,000 mi / 6 mo*). The app shows
  **due soon / overdue** based on your latest odometer reading.
- **Fuel log** — record each fill-up's cost (and optional gallons to auto-calc
  **MPG** and **cost-per-mile**).
- **Spend totals** — per car and broken down by maintenance vs. fuel.
- **Password protected** — one password you set; you stay logged in on your phone.

## Tech stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Drizzle ORM → Neon Postgres
- Auth via a signed cookie + middleware (no third-party auth service)

---

## 1. Set up the database (Neon)

1. Go to <https://neon.tech>, create a free account and a new project.
   - Or, in the **Vercel dashboard → Storage → Create Database → Neon**, which
     wires the connection string into your project automatically.
2. Copy the **pooled** connection string (looks like
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require`).

## 2. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable       | What it is                                                        |
| -------------- | ----------------------------------------------------------------- |
| `DATABASE_URL` | Your Neon pooled connection string.                               |
| `APP_PASSWORD` | The password you'll type to log in.                               |
| `AUTH_SECRET`  | A long random string used to sign the login cookie.               |

Optional — for email service reminders (see below):

| Variable          | What it is                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `RESEND_API_KEY`  | API key from [resend.com](https://resend.com). Enables sending.     |
| `NOTIFY_EMAIL`    | Address that receives reminder emails.                              |
| `NOTIFY_FROM`     | From address. Default `onboarding@resend.dev` works to your own inbox. |
| `CRON_SECRET`     | Random string protecting the cron endpoint (Vercel sends it for you). |
| `APP_URL`         | Your deployed URL, used for the link button in emails.             |

Generate a good `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Create the database tables

With `DATABASE_URL` set in `.env.local`, push the schema to Neon:

```bash
npm install
npm run db:push
```

This creates the `cars`, `maintenance`, `maintenance_items`, `fuel`, and
`service_schedules` tables.

## 4. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>, log in with `APP_PASSWORD`, and add your first car.

---

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Under **Settings → Environment Variables**, add `DATABASE_URL`, `APP_PASSWORD`,
   and `AUTH_SECRET` (for all environments). If you created the Neon DB through
   Vercel's Storage tab, `DATABASE_URL` is already there.
4. Deploy. After the first deploy, run the schema push once against the production
   database — either locally with the production `DATABASE_URL`:

   ```bash
   npm run db:push
   ```

   or from the Neon SQL editor using the generated SQL in `./drizzle`.

> **Tip:** Add the site to your phone's home screen (Share → *Add to Home Screen*)
> for an app-like, full-screen experience.

---

## How service reminders work

- A car's **current odometer** is the highest mileage you've entered on any
  maintenance entry or fill-up.
- Each **service schedule** tracks when it was last done — either from a manual
  baseline you enter, or automatically from a maintenance entry you tag as
  "counts as this service".
- The app computes `next due = last done + interval` and flags it:
  - 🔴 **Overdue** — past due by miles or date
  - 🟡 **Due soon** — within 500 mi or 14 days
  - 🟢 **OK** — otherwise

## Email service reminders

A daily cron job (`vercel.json` → `/api/cron/check-services`) checks every car's
service schedules and emails you a digest of anything **due soon or overdue**.

- **Setup:** create a free account at [resend.com](https://resend.com), make an
  API key, and set `RESEND_API_KEY` + `NOTIFY_EMAIL`. On Resend's free tier the
  default `onboarding@resend.dev` sender can email **the address you signed up
  with** — so sign up with the same address you put in `NOTIFY_EMAIL`. To email
  any address, verify a domain in Resend and set `NOTIFY_FROM` to it.
- **Anti-spam logic:** you get an email when a service first becomes due, again
  if it escalates from *due soon* to *overdue*, then at most once every 7 days
  while it stays overdue. Services that are no longer due reset automatically.
- **Schedule:** runs daily at 13:00 UTC. Change the `schedule` cron in
  `vercel.json` if you like. (The cron job only runs on Vercel, not locally. To
  test locally, GET `/api/cron/check-services` while `npm run dev` is running.)
- **On Vercel:** add `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM`,
  `CRON_SECRET`, and `APP_URL` in the project's environment variables. Vercel
  automatically sends `CRON_SECRET` as a Bearer token to the scheduled request.

> Note: Vercel's Hobby (free) plan runs cron jobs once per day, which is exactly
> what this uses.

## Useful scripts

| Command            | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start the dev server.                        |
| `npm run build`    | Production build.                            |
| `npm run db:push`  | Sync the Drizzle schema to your database.    |
| `npm run db:studio`| Open Drizzle Studio to browse/edit data.     |
