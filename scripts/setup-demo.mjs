/**
 * setup-demo.mjs
 *
 * One-shot script to create the Spear demo account and seed it with
 * realistic call data so the dashboard looks fully live for demos.
 *
 * Usage:
 *   node scripts/setup-demo.mjs
 *
 * Requirements:
 *   - SUPABASE_SERVICE_ROLE_KEY must be filled in .env.local
 *   - App must be running (npm run dev) OR deployed (uses NEXT_PUBLIC_SITE_URL)
 *
 * What it does:
 *   1. Creates demo@spearai.live in Supabase Auth (or resets if it exists)
 *   2. Seeds 12 realistic call sessions with NEPQ scores, objections, DISC profiles
 *   3. Upserts an agent profile with aggregate stats
 *   4. Inserts a pro subscription so all features are unlocked
 *   5. Prints the login credentials
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(__dirname, "../.env.local");
const envRaw  = readFileSync(envPath, "utf8");
const env     = Object.fromEntries(
  envRaw.split("\n")
    .filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL      = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET      = env.ADMIN_SECRET || "spear-demo-2026";
const SITE_URL          = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Demo credentials
const DEMO_EMAIL    = "demo@spearai.live";
const DEMO_PASSWORD = "SpearDemo2026!";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("\n❌  SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  console.error("   Go to: https://supabase.com/dashboard → your project → Settings → API → service_role");
  console.error("   Paste it into .env.local next to SUPABASE_SERVICE_ROLE_KEY=\n");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "apikey": SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
};

// ── 1. Create or reset demo user ─────────────────────────────────────────────
async function getOrCreateDemoUser() {
  console.log("🔍  Looking up demo user...");

  // List users and find existing demo account
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers });
  const listData = await listRes.json();
  const existing = (listData.users || []).find(u => u.email === DEMO_EMAIL);

  if (existing) {
    console.log(`✅  Found existing demo user: ${existing.id}`);
    // Reset password
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password: DEMO_PASSWORD, email_confirm: true }),
    });
    console.log("🔑  Password reset.");
    return existing.id;
  }

  // Create new user
  console.log("➕  Creating demo user...");
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Agent" },
    }),
  });
  const created = await createRes.json();
  if (!created.id) {
    console.error("❌  Failed to create user:", JSON.stringify(created, null, 2));
    process.exit(1);
  }
  console.log(`✅  Created demo user: ${created.id}`);
  return created.id;
}

// ── 2. Insert pro subscription ────────────────────────────────────────────────
async function ensureProSubscription(userId) {
  console.log("💳  Setting up Pro subscription...");

  // Delete any existing
  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...headers, "Prefer": "return=minimal" },
  });

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      plan: "team",
      status: "active",
      stripe_customer_id: "cus_demo_spear",
      stripe_subscription_id: `sub_demo_${Date.now()}`,
      current_period_end: periodEnd.toISOString(),
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.warn("⚠️   Subscription insert warning:", txt);
  } else {
    console.log("✅  Pro subscription active (1 year).");
  }
}

// ── 3. Seed call sessions + agent profile via seed-demo endpoint ──────────────
async function seedDemoData(userId) {
  console.log("🌱  Seeding demo call data...");

  // Try deployed URL first, then localhost
  const urls = [
    `${SITE_URL}/api/admin/seed-demo`,
    "http://localhost:3000/api/admin/seed-demo",
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": ADMIN_SECRET,
        },
        body: JSON.stringify({ userId }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`✅  Seeded ${data.callsSeeded} demo calls via ${url}`);
        return;
      } else {
        const txt = await res.text();
        console.warn(`⚠️   ${url} returned ${res.status}: ${txt}`);
      }
    } catch (e) {
      // Try next URL
    }
  }

  // Fallback: seed directly via Supabase REST if app isn't running
  console.log("📡  App not reachable — seeding directly via Supabase REST...");
  await seedDirectly(userId);
}

// ── Direct seed fallback (if app isn't running) ───────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
  return d.toISOString();
}

async function seedDirectly(userId) {
  // Delete existing
  await fetch(`${SUPABASE_URL}/rest/v1/call_sessions?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...headers, "Prefer": "return=minimal" },
  });

  const calls = [
    {
      user_id: userId, created_at: daysAgo(1), prospect_name: "Robert Chen",
      duration_seconds: 1724, outcome: "closed", overall_score: 8.7,
      disc_profile_detected: "D", talk_ratio_agent: 34, talk_ratio_prospect: 66,
      product_name: "Mortgage Protection",
      objections_raised: [{ type: "existing_coverage", text: "I already have some through work", handling: "resolved" }],
      nepq_phases_completed: {
        connection: { score: 9, note: "Strong rapport — referenced their mortgage lender naturally." },
        situation: { score: 8, note: "Uncovered group coverage gap of $50k vs. $800k income replacement need." },
        problemAwareness: { score: 8.5, note: "Prospect verbalized the gap himself — didn't need to push." },
        consequence: { score: 8, note: "Good use of family framing. Could have gone deeper on timeline." },
        solutionAwareness: { score: 9, note: "Prospect asked for the solution before it was presented." },
        qualifying: { score: 9, note: "Budget, health, and decision authority all confirmed cleanly." },
        close: { score: 8.5, note: "Two-option close worked. Committed on first ask." },
      },
      coaching_cards_fired: [{ id: "c1", type: "OBJECTION" }, { id: "c2", type: "CLOSE_SIGNAL" }],
      cards_accepted: ["c1", "c2"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Replicate the two-option close framing on every call going forward." }),
    },
    {
      user_id: userId, created_at: daysAgo(2), prospect_name: "Maria Vasquez",
      duration_seconds: 2482, outcome: "not_closed", overall_score: 5.2,
      disc_profile_detected: "S", talk_ratio_agent: 58, talk_ratio_prospect: 42,
      product_name: "Mortgage Protection",
      objections_raised: [
        { type: "think_about_it", text: "I need to think about it", handling: "deflected" },
        { type: "spouse", text: "I have to talk to my husband", handling: "acknowledged" },
        { type: "price", text: "That's more than I was thinking", handling: "deflected" },
      ],
      nepq_phases_completed: {
        connection: { score: 7, note: "Moved too fast — cut off prospect mid-sentence twice." },
        situation: { score: 6, note: "Rushed. Missed depth on current coverage." },
        problemAwareness: { score: 5, note: "Told the prospect they had a problem instead of letting them discover it." },
        consequence: { score: 4, note: "Skipped consequence entirely — jumped straight to solution." },
        solutionAwareness: { score: 5, note: "Presented before prospect was ready." },
        qualifying: { score: 6, note: "Spouse not involved early enough." },
        close: { score: 4, note: "Accepted 'think about it' without isolating the real objection." },
      },
      coaching_cards_fired: [{ id: "c3", type: "OBJECTION" }, { id: "c4", type: "NEPQ_MOVE" }],
      cards_accepted: ["c4"], cards_dismissed: ["c3"],
      notes: JSON.stringify({ nextCallFocus: "Never accept 'think about it' — isolate: 'What specifically do you want to think through?'" }),
    },
    {
      user_id: userId, created_at: daysAgo(3), prospect_name: "James Whitfield",
      duration_seconds: 1998, outcome: "closed", overall_score: 9.1,
      disc_profile_detected: "I", talk_ratio_agent: 31, talk_ratio_prospect: 69,
      product_name: "Mortgage Protection",
      objections_raised: [
        { type: "price", text: "Is that the best you can do?", handling: "resolved" },
        { type: "timing", text: "Can we start next month?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection: { score: 10, note: "Exceptional rapport. Matched I-type energy perfectly." },
        situation: { score: 9, note: "Full picture — kids, mortgage, spouse's income all covered." },
        problemAwareness: { score: 9, note: "Prospect said: 'I hadn't really thought about what would happen to them.' Textbook." },
        consequence: { score: 9, note: "Strong emotional anchor. Used specific timeline questions effectively." },
        solutionAwareness: { score: 9, note: "Prospect asked 'so what would that look like?' before solution was presented." },
        qualifying: { score: 8.5, note: "Health pre-screened naturally in conversation." },
        close: { score: 9.5, note: "Smooth two-option close. Prospect said yes before options were finished." },
      },
      coaching_cards_fired: [{ id: "c6", type: "DISC_INSIGHT" }, { id: "c7", type: "CLOSE_SIGNAL" }, { id: "c8", type: "OBJECTION" }],
      cards_accepted: ["c6", "c7", "c8"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "This call is the benchmark. Study the consequence phase — 3 escalating timeline questions before presenting." }),
    },
    {
      user_id: userId, created_at: daysAgo(4), prospect_name: "Diane Park",
      duration_seconds: 1377, outcome: "closed", overall_score: 7.8,
      disc_profile_detected: "C", talk_ratio_agent: 38, talk_ratio_prospect: 62,
      product_name: "Final Expense",
      objections_raised: [
        { type: "other", text: "How do I know this company is reliable?", handling: "resolved" },
        { type: "other", text: "Can I see the policy documents first?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection: { score: 8, note: "C-type appreciated the process explanation upfront." },
        situation: { score: 8, note: "Thorough discovery. Let prospect ask all her questions." },
        problemAwareness: { score: 7.5, note: "Data-driven approach worked well for this buyer type." },
        consequence: { score: 7, note: "Used numbers effectively but could have added emotional layer." },
        solutionAwareness: { score: 8, note: "Walked through the mechanics — C-type appreciated this." },
        qualifying: { score: 8.5, note: "C-type wanted all details before deciding." },
        close: { score: 8, note: "Logical close worked: 'Based on the numbers, this is the most efficient option.'" },
      },
      coaching_cards_fired: [{ id: "c9", type: "DISC_INSIGHT" }, { id: "c10", type: "OBJECTION" }],
      cards_accepted: ["c9", "c10"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "For C-types, lead with carrier AM Best ratings early. They're deciding on trust before price." }),
    },
    {
      user_id: userId, created_at: daysAgo(7), prospect_name: "Tony Okafor",
      duration_seconds: 2831, outcome: "not_closed", overall_score: 5.9,
      disc_profile_detected: "D", talk_ratio_agent: 61, talk_ratio_prospect: 39,
      product_name: "Mortgage Protection",
      objections_raised: [
        { type: "think_about_it", text: "Let me think it over this week", handling: "ignored" },
        { type: "price", text: "That's way out of my budget", handling: "deflected" },
        { type: "existing_coverage", text: "My job covers me well enough", handling: "deflected" },
        { type: "spouse", text: "I need to run this by my wife", handling: "acknowledged" },
      ],
      nepq_phases_completed: {
        connection: { score: 7, note: "D-type wanted to get straight to business — too long on rapport." },
        situation: { score: 5, note: "Through situation in under 3 minutes. Missed critical coverage details." },
        problemAwareness: { score: 5.5, note: "Presented features before the problem was acknowledged." },
        consequence: { score: 4, note: "Consequence phase skipped entirely. Prospect never felt urgency." },
        solutionAwareness: { score: 5, note: "Jumped to product too early — lost D-type's interest." },
        qualifying: { score: 6, note: "Budget objection surfaced late because qualifying happened after pitching." },
        close: { score: 5, note: "Talked too much at the close. D-types need a direct ask." },
      },
      coaching_cards_fired: [{ id: "c11", type: "NEPQ_MOVE" }, { id: "c12", type: "OBJECTION" }, { id: "c13", type: "NEPQ_MOVE" }],
      cards_accepted: ["c11"], cards_dismissed: ["c12"],
      notes: JSON.stringify({ nextCallFocus: "Talk ratio was 61% — you ran a presentation, not a sales call. Set a timer: 30 seconds of talking without a question = stop and ask one." }),
    },
    {
      user_id: userId, created_at: daysAgo(8), prospect_name: "Natalie Ford",
      duration_seconds: 2200, outcome: "closed", overall_score: 8.1,
      disc_profile_detected: "S", talk_ratio_agent: 36, talk_ratio_prospect: 64,
      product_name: "Mortgage Protection",
      objections_raised: [
        { type: "spouse", text: "I'd want to involve my husband in this decision", handling: "resolved" },
        { type: "think_about_it", text: "Can I sleep on it?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection: { score: 8.5, note: "Perfect pace for S-type. Took time, built real trust." },
        situation: { score: 8, note: "Family-first framing resonated. Uncovered 3 dependents and a mortgage." },
        problemAwareness: { score: 8, note: "'What does your family do financially if you're not there?' landed hard." },
        consequence: { score: 7.5, note: "Good emotional anchoring. Prospect teared up." },
        solutionAwareness: { score: 8, note: "'So you'd want something permanent then' was a perfect bridge." },
        qualifying: { score: 8, note: "Proactively suggested getting husband on the call — smart move." },
        close: { score: 8.5, note: "Didn't rush. Gave her space to decide. She came back with yes." },
      },
      coaching_cards_fired: [{ id: "c15", type: "DISC_INSIGHT" }, { id: "c16", type: "OBJECTION" }, { id: "c17", type: "CLOSE_SIGNAL" }],
      cards_accepted: ["c15", "c16", "c17"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "S-type playbook worked perfectly. Remember: silence is comfort for S-types, not hesitation." }),
    },
    {
      user_id: userId, created_at: daysAgo(14), prospect_name: "Carl Bennett",
      duration_seconds: 3258, outcome: "not_closed", overall_score: 6.4,
      disc_profile_detected: "C", talk_ratio_agent: 44, talk_ratio_prospect: 56,
      product_name: "IUL",
      objections_raised: [
        { type: "other", text: "I want to compare this with other carriers", handling: "acknowledged" },
        { type: "price", text: "The premium is higher than I expected", handling: "deflected" },
        { type: "timing", text: "Give me a few weeks to research", handling: "acknowledged" },
      ],
      nepq_phases_completed: {
        connection: { score: 8, note: "Strong start. C-type appreciated the structured intro." },
        situation: { score: 7, note: "Good but missed asking about existing policies in detail." },
        problemAwareness: { score: 7, note: "Data points presented well but missed emotional layer." },
        consequence: { score: 5.5, note: "Consequence too logical — not visceral enough even for a C-type." },
        solutionAwareness: { score: 6, note: "Moved to solution before prospect asked for it." },
        qualifying: { score: 6.5, note: "Didn't address comparison-shopping objection proactively." },
        close: { score: 6, note: "C-type needed more data. Should have offered a written comparison." },
      },
      coaching_cards_fired: [{ id: "c18", type: "NEPQ_MOVE" }, { id: "c19", type: "OBJECTION" }],
      cards_accepted: ["c18"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "For C-types who want to compare: offer to do the comparison WITH them on the call. Takes away the reason to leave." }),
    },
    {
      user_id: userId, created_at: daysAgo(15), prospect_name: "Sharon Miles",
      duration_seconds: 1773, outcome: "closed", overall_score: 9.2,
      disc_profile_detected: "S", talk_ratio_agent: 29, talk_ratio_prospect: 71,
      product_name: "Mortgage Protection",
      objections_raised: [
        { type: "existing_coverage", text: "We have a small policy but I'm not sure of the amount", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection: { score: 9.5, note: "Best connection phase this month. Sharing personal details within 2 minutes." },
        situation: { score: 9, note: "Uncovered underfunded group policy and two school-age kids." },
        problemAwareness: { score: 9.5, note: "Prospect said: 'I've never actually thought about what would happen.' Perfect setup." },
        consequence: { score: 9, note: "'How long could your family stay in the house?' — devastating and effective." },
        solutionAwareness: { score: 9, note: "Prospect was asking for options before consequence phase was even finished." },
        qualifying: { score: 9, note: "Health and budget cleared naturally in conversation." },
        close: { score: 9.5, note: "Committed in under 30 seconds. One of the cleanest closes on record." },
      },
      coaching_cards_fired: [{ id: "c20", type: "OBJECTION" }, { id: "c21", type: "CLOSE_SIGNAL" }],
      cards_accepted: ["c20", "c21"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Talk ratio 29% — this is what every call should look like. The prospect closed herself." }),
    },
    {
      user_id: userId, created_at: daysAgo(20), prospect_name: "Kevin Yuen",
      duration_seconds: 2339, outcome: "closed", overall_score: 7.1,
      disc_profile_detected: "I", talk_ratio_agent: 41, talk_ratio_prospect: 59,
      product_name: "Term Life",
      objections_raised: [
        { type: "think_about_it", text: "This is a lot to take in, I need to process it", handling: "resolved" },
        { type: "spouse", text: "My partner would want to know about this", handling: "resolved" },
        { type: "price", text: "Monthly payments add up", handling: "acknowledged" },
      ],
      nepq_phases_completed: {
        connection: { score: 8, note: "Good energy match with I-type prospect." },
        situation: { score: 7, note: "Decent but rushed the family situation questions." },
        problemAwareness: { score: 7, note: "Problem surfaced but could have been sharper." },
        consequence: { score: 6, note: "Too short. I-type needed more emotional story." },
        solutionAwareness: { score: 7, note: "Transition to solution was smooth." },
        qualifying: { score: 7.5, note: "Partner involvement handled well on second attempt." },
        close: { score: 7, note: "Closed but required two attempts. First ask was too soft." },
      },
      coaching_cards_fired: [{ id: "c22", type: "NEPQ_MOVE" }, { id: "c23", type: "OBJECTION" }, { id: "c24", type: "DISC_INSIGHT" }],
      cards_accepted: ["c22", "c23"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "I-types buy on story and legacy. Practice: 'Imagine your kids looking back years from now knowing you had this handled.'" }),
    },
    {
      user_id: userId, created_at: daysAgo(21), prospect_name: "Patricia Lowry",
      duration_seconds: 1502, outcome: "not_closed", overall_score: 6.8,
      disc_profile_detected: "D", talk_ratio_agent: 47, talk_ratio_prospect: 53,
      product_name: "Mortgage Protection",
      objections_raised: [
        { type: "timing", text: "I'm in the middle of something, call me back", handling: "acknowledged" },
        { type: "other", text: "My accountant handles all of this", handling: "deflected" },
      ],
      nepq_phases_completed: {
        connection: { score: 7, note: "D-type wanted to skip small talk. You obliged — good instinct." },
        situation: { score: 7, note: "Efficient situation questions — appropriate for D-type." },
        problemAwareness: { score: 6, note: "Good framing but prospect not fully engaged." },
        consequence: { score: 6.5, note: "Consequence was direct but prospect deflected to accountant." },
        solutionAwareness: { score: 7, note: "Solution presented cleanly and concisely." },
        qualifying: { score: 7, note: "Budget not fully established before presentation." },
        close: { score: 6, note: "Accountant objection needed a sharper response." },
      },
      coaching_cards_fired: [{ id: "c25", type: "OBJECTION" }, { id: "c26", type: "NEPQ_MOVE" }],
      cards_accepted: ["c25"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "'My accountant handles this' is a trust objection. Respond: 'Is there a concern about the product itself, or is it more about a second opinion?'" }),
    },
    {
      user_id: userId, created_at: daysAgo(28), prospect_name: "Marcus Webb",
      duration_seconds: 2100, outcome: "closed", overall_score: 7.5,
      disc_profile_detected: "I", talk_ratio_agent: 39, talk_ratio_prospect: 61,
      product_name: "Mortgage Protection",
      objections_raised: [{ type: "price", text: "Can we find something more affordable?", handling: "resolved" }],
      nepq_phases_completed: {
        connection: { score: 8, note: "Great energy." },
        situation: { score: 7.5, note: "Good family discovery." },
        problemAwareness: { score: 7, note: "Problem well articulated." },
        consequence: { score: 7, note: "Solid consequence work." },
        solutionAwareness: { score: 7.5, note: "Clean transition." },
        qualifying: { score: 8, note: "Budget handled well." },
        close: { score: 8, note: "Clean close on second option." },
      },
      coaching_cards_fired: [{ id: "c27", type: "OBJECTION" }],
      cards_accepted: ["c27"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Focus on deepening consequence phase — you're leaving emotional urgency on the table." }),
    },
    {
      user_id: userId, created_at: daysAgo(30), prospect_name: "Linda Castillo",
      duration_seconds: 1850, outcome: "closed", overall_score: 8.3,
      disc_profile_detected: "S", talk_ratio_agent: 33, talk_ratio_prospect: 67,
      product_name: "Final Expense",
      objections_raised: [{ type: "spouse", text: "My husband would want to know about this", handling: "resolved" }],
      nepq_phases_completed: {
        connection: { score: 9, note: "Strong family connection built." },
        situation: { score: 8, note: "Full situation picture." },
        problemAwareness: { score: 8, note: "Prospect self-identified the gap." },
        consequence: { score: 8, note: "Good emotional consequence work." },
        solutionAwareness: { score: 8, note: "Natural transition." },
        qualifying: { score: 8.5, note: "Spouse looped in proactively." },
        close: { score: 8.5, note: "Confident close." },
      },
      coaching_cards_fired: [{ id: "c28", type: "DISC_INSIGHT" }, { id: "c29", type: "CLOSE_SIGNAL" }],
      cards_accepted: ["c28", "c29"], cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Your S-type playbook is dialed in — use this as a model for family-focused prospects." }),
    },
  ];

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/call_sessions`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify(calls),
  });

  if (!insertRes.ok) {
    const txt = await insertRes.text();
    console.error("❌  Failed to seed calls:", txt);
    return;
  }

  console.log(`✅  Seeded ${calls.length} demo calls directly.`);

  // Upsert agent profile
  await fetch(`${SUPABASE_URL}/rest/v1/agent_profiles?agent_id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...headers, "Prefer": "return=minimal" },
  });

  await fetch(`${SUPABASE_URL}/rest/v1/agent_profiles`, {
    method: "POST",
    headers: { ...headers, "Prefer": "return=minimal" },
    body: JSON.stringify({
      agent_id: userId,
      total_calls: 12,
      close_rate: 0.583,
      avg_talk_ratio: 40.1,
      avg_overall_score: 7.68,
      most_common_disc_type: "S",
      weak_nepq_phases: ["consequence"],
      strong_nepq_phases: ["connection", "close"],
      most_missed_objections: ["think_about_it", "price"],
      most_accepted_card_types: ["OBJECTION", "CLOSE_SIGNAL", "DISC_INSIGHT"],
      last_5_outcomes: ["closed", "not_closed", "closed", "closed", "not_closed"],
      coaching_focus: "Your consequence phase is holding back your close rate. Practice the cost-of-inaction sequence until it's automatic on every call.",
    }),
  });
  console.log("✅  Agent profile seeded.");
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("\n🎯  Spear Demo Setup\n" + "─".repeat(40));

  const userId = await getOrCreateDemoUser();
  await ensureProSubscription(userId);
  await seedDemoData(userId);

  console.log("\n" + "─".repeat(40));
  console.log("✅  Demo account ready!\n");
  console.log(`   🌐  URL:      ${SITE_URL}`);
  console.log(`   📧  Email:    ${DEMO_EMAIL}`);
  console.log(`   🔑  Password: ${DEMO_PASSWORD}`);
  console.log(`   📊  Calls:    12 (spanning 30 days)`);
  console.log(`   💳  Plan:     Team (all features unlocked)`);
  console.log("\n" + "─".repeat(40) + "\n");
})();
