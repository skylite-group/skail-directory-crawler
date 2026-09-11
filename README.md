# skail-directory-crawler

Crawler for the SKAIL business directory.

**Public on purpose.** GitHub Actions minutes are unmetered on public
repositories and metered on private ones, and a crawler is a long-running
scheduled job — that difference is the reason this lives outside the main
repo rather than inside it.

Being public imposes two rules, enforced by a test that runs on every push:

1. **No secrets in code.** Every credential arrives from repository secrets at
   run time. `scripts/no-secrets.mjs` fails the build on anything resembling a
   key committed to the tree.
2. **No personal data.** This crawler reads public Google Maps business
   listings — trading name, category, public phone, website, rating. It does
   not collect named individuals, personal email addresses, or anything that
   would make this a personal-data processing operation. Business contact
   details of a company are not personal data; a named person's work email is,
   and that line is deliberate.

## What it does

Once a month, for each configured trade × city, it queries Google Maps through
SerpAPI and posts the results to SKAIL, which records where each business
ranked on that date. The value is the time series, not the snapshot.

## Budget

SerpAPI is currently on a free plan: **250 searches/month**. `targets.json` is
sized to stay inside it with headroom, and the workflow refuses to run if the
plan does not have enough searches left — an overrun would break the prospector
that paying features depend on, and a directory is worth less than that.
