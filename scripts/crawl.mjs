#!/usr/bin/env node
/**
 * Monthly directory crawl.
 *
 * For each configured trade x city: query Google Maps via SerpAPI, post the
 * results to SKAIL, which records where each business ranked TODAY. The value
 * is the time series — one snapshot is a list, twelve is an observation
 * record, and nobody can scrape that because it is a history of us watching.
 *
 * BUDGET IS CHECKED BEFORE ANY SEARCH RUNS. SerpAPI is on a 250/month free
 * plan shared with the live prospector, which paying features depend on. A
 * background crawl that starves it would trade something valuable for
 * something speculative, so this refuses to start rather than degrade it.
 */

const SERPAPI = process.env.SERPAPI_KEY;
const SKAIL_URL = process.env.SKAIL_API_URL ?? "https://skail.skylite.group";
const TOKEN = process.env.SKAIL_SERVICE_TOKEN;
const DRY = process.env.DRY_RUN === "true";

/** Leave this many searches for the live prospector, always. */
const RESERVE_FOR_PROSPECTOR = 100;

async function json(url, init) {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

async function budget() {
  const { ok, body } = await json(`https://serpapi.com/account?api_key=${SERPAPI}`);
  if (!ok) return null;
  return {
    left: Number(body.total_searches_left ?? 0),
    plan: String(body.plan_name ?? "unknown"),
    used: Number(body.this_month_usage ?? 0),
  };
}

async function searchMaps(service, location) {
  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("engine", "google_maps");
  u.searchParams.set("q", `${service} ${location}`);
  u.searchParams.set("type", "search");
  u.searchParams.set("api_key", SERPAPI);
  const { ok, status, body } = await json(u);
  if (!ok) return { ok: false, error: `serpapi ${status}` };
  const results = body.local_results ?? [];
  return {
    ok: true,
    prospects: results.map((r, i) => ({
      name: r.title,
      position: r.position ?? i + 1,
      rating: r.rating ?? null,
      reviews: r.reviews ?? 0,
      phone: r.phone ?? null,
      website: r.website ?? null,
      address: r.address ?? null,
      placeId: r.place_id ?? null,
      reason: "directory crawl",
    })),
  };
}

async function post(query, prospects) {
  if (DRY) return { ok: true, body: { dryRun: true, wouldRecord: prospects.length } };
  return json(`${SKAIL_URL}/api/ext/directory?op=record`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-saig-service-token": TOKEN, "X-SAIG-App": "crawler" },
    body: JSON.stringify({ query, prospects }),
  });
}

async function main() {
  if (!SERPAPI) { console.error("SERPAPI_KEY missing"); process.exit(1); }
  if (!TOKEN && !DRY) { console.error("SKAIL_SERVICE_TOKEN missing"); process.exit(1); }

  const { targets, monthlyBudget } = JSON.parse(
    await (await import("node:fs/promises")).readFile("targets.json", "utf8"),
  );

  const b = await budget();
  if (!b) { console.error("could not read SerpAPI budget — refusing to guess"); process.exit(1); }
  console.log(`SerpAPI: ${b.plan}, ${b.used} used this month, ${b.left} left`);

  // min() across all three limits: how many targets exist, what we budgeted
  // for a month, and what is left after reserving the prospector's quota.
  // An earlier version compared against monthlyBudget FIRST, which meant a
  // dwindling quota still ran the full 18 until it crossed the reserve in one
  // step — the crawl would look healthy right up to the moment it starved the
  // prospector. Degrading gradually is the point of having a budget at all.
  const affordable = Math.max(0, Math.min(targets.length, monthlyBudget, b.left - RESERVE_FOR_PROSPECTOR));
  if (affordable === 0) {
    // Not an error. Refusing to spend the prospector's quota is the correct
    // outcome, and exiting 1 would page somebody about working as designed.
    console.log(`Nothing to do: ${b.left} searches left, reserving ${RESERVE_FOR_PROSPECTOR} for the live prospector.`);
    return;
  }
  if (affordable < targets.length) {
    console.log(`Budget allows ${affordable} of ${targets.length} targets this run.`);
  }

  let recorded = 0, failed = 0;
  for (const t of targets.slice(0, affordable)) {
    const q = `${t.service} ${t.location}`;
    const r = await searchMaps(t.service, t.location);
    if (!r.ok) { console.log(`  FAIL ${q}: ${r.error}`); failed++; continue; }
    const posted = await post(q, r.prospects);
    if (!posted.ok) { console.log(`  FAIL post ${q}: ${posted.status}`); failed++; continue; }
    recorded += r.prospects.length;
    console.log(`  ok ${q}: ${r.prospects.length} businesses`);
    // Courtesy pacing. Nothing here is urgent, and hammering an API we depend
    // on to save four minutes is a bad trade.
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log(`\nDone: ${recorded} observations recorded, ${failed} failed.`);
  if (failed > 0 && recorded === 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
