# Future Living Survey 2026

betterhomes' annual Dubai/UAE residential property-sentiment survey — third edition.
A single self-contained HTML survey that adapts its questions to the respondent's
emirate (Dubai, Abu Dhabi, or Sharjah) and stores responses in Supabase.

**Live:** https://survey.bhomes.com/future-living-survey

---

## Architecture

Three independent systems, connected by simple HTTP:

```
┌──────────────────────────┐      ┌───────────────────────────┐      ┌────────────────────┐
│  VERCEL (static hosting)  │      │  SUPABASE EDGE FUNCTION   │      │  SUPABASE POSTGRES │
│  index.html + 3 images    │ POST │  /functions/v1/survey     │INSERT│  survey_responses  │
│  vanilla HTML / CSS / JS  │─────▶│  (TypeScript / Deno)      │─────▶│  table             │
└──────────────────────────┘      └───────────────────────────┘      └────────────────────┘
        ▲                                                              
   respondent's browser              also POSTs in parallel ─▶  n8n webhook (engageteam)
```

- **Front-end** — a single `index.html` with inline CSS and vanilla JavaScript. No
  framework, no build step. Vercel serves it as static files.
- **Backend** — a Supabase Edge Function (`supabase/functions/survey/index.ts`,
  TypeScript on Deno) receives each submission and inserts it into Postgres using the
  service-role key (which lives only on Supabase, never in the browser).
- **Database** — the `survey_responses` table in Supabase Postgres.
- **Automation** — every submission is also POSTed in parallel to an n8n webhook for
  downstream automation.

## Repository layout

```
.
├── index.html                       # the survey (Vercel serves this at /)
├── vercel.json                      # static-site config (no build step)
├── assets/
│   ├── hero-cityscape.jpg           # hero background image
│   ├── hero-logo.png                # "Future living — Third edition" lockup
│   └── bh-logo.png                  # betterhomes wordmark (header)
├── supabase/
│   └── functions/
│       └── survey/
│           └── index.ts             # edge function source (backup / reference)
└── docs/
    ├── survey_user_journey.html     # full question-by-question journey map
    ├── Future_Living_Survey_2026_Analysis.pdf
    ├── Future_Living_Survey_2026_Pathways.pdf
    ├── FutureLiving_Survey_Questions_AbuDhabi.docx
    └── FutureLiving_Survey_Questions_Sharjah.docx
```

The three images live in `assets/` and are referenced from `index.html` as
`assets/hero-cityscape.jpg`, `assets/hero-logo.png`, `assets/bh-logo.png`.

> The edge function and n8n workflow are deployed on Supabase / n8n respectively —
> the copy here is for reference and backup. Editing it in this repo does **not**
> redeploy it; use the Supabase dashboard / CLI for that.

## How the emirate logic works

1. The survey opens with a screening question: *"Which emirate do you currently reside in?"*
2. On selecting an emirate, `applyEmirate()` runs and:
   - Swaps the word "Dubai" → the chosen emirate across all question text (Dubai path is left untouched).
   - Shows/hides emirate-specific questions (e.g. ADGM influence and rent-freeze for Abu Dhabi; freehold awareness and the 3-year rent-review for Sharjah).
   - Swaps community dropdowns to the relevant emirate's list.
   - Adjusts validation thresholds (e.g. the Sharjah rent floor is lower).
3. The chosen emirate is stored as the first content column of every `survey_responses` row, so analytics can group/filter by emirate directly.

Shared questions are identical across all three emirates for clean cross-emirate comparison.

## Deploying

This repo is a **static site** — no build command, no dependencies, no output directory
(see `vercel.json`).

### First-time setup on a fresh GitHub repo + Vercel

1. **Push to GitHub** — create a repo, then either drag these files into GitHub's
   "Add file → Upload files" web uploader, or `git push` them.
2. **Add collaborators** — GitHub repo → **Settings → Collaborators → Add people**.
3. **Connect Vercel** — in Vercel: **Add New → Project → Import** the GitHub repo.
   - Framework Preset: **Other**
   - Build Command: **(leave empty)**
   - Output Directory: **(leave empty)** — `vercel.json` already declares it's static
   - Click **Deploy**. Done.
4. From then on, every push to `main` auto-deploys. Pull requests get preview URLs.

### Custom domain and the `/future-living-survey` path

The survey is served at **`survey.bhomes.com/future-living-survey`**:

1. **Domain** — in Vercel: **Project → Settings → Domains → Add** `survey.bhomes.com`,
   then add the CNAME it shows you at your DNS provider.
2. **Path** — handled entirely in `vercel.json` (no DNS/folder changes needed):
   - a **rewrite** makes `/future-living-survey` serve `index.html`, and
   - a **redirect** sends the bare domain (`/`) to `/future-living-survey`.

   Because of this, all in-page asset references use root-absolute paths
   (`/assets/...`) so images load correctly regardless of the URL path.

### Important: where the data goes

The survey front-end can be hosted anywhere (any Vercel account, any domain) — but it
**always POSTs submissions to the same Supabase project and n8n webhook** that are
hard-coded in `index.html`:

- Supabase endpoint: `…supabase.co/functions/v1/survey`  (search `SUBMIT_URL` in `index.html`)
- n8n webhook: `…n8n.cloud/webhook/future-living-survey`  (search `WEBHOOK_URL`)

Hosting on a different Vercel **does not** change where responses are stored. If a new
deployment needs its **own** backend, you must (a) stand up a new Supabase project +
`survey` edge function + `survey_responses` table, and (b) update those two URLs in
`index.html`.

## Data

Each submission writes one row to `survey_responses`. Columns (in order):
`id`, `created_at`, `emirate`, `full_name`, `email`, `phone`, `marketing_opt_in`,
`consent`, `tenure`, `living_situation`, `wants_valuation`, `user_agent`, `referrer`,
`responses` (JSONB).

The `responses` JSONB holds every answer keyed by question code, plus an `_answers`
array giving each question's visible number, code, question text, required flag,
answered flag, and the human-readable answer — in the exact order the respondent saw them.
