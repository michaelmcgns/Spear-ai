import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * POST /api/admin/seed-demo
 *
 * Seeds realistic demo call data for a given user so their dashboard,
 * analytics, and coaching tab all look fully populated during client demos.
 *
 * Protected by ADMIN_SECRET header.
 *
 * Body: { userId: string }
 */

// ─── Demo call data ───────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  // Vary the time of day
  d.setHours(8 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
  return d.toISOString();
}

function buildDemoCalls(agentId: string) {
  return [
    // ── Week 1 (recent) ──────────────────────────────────────────────
    {
      agent_id: agentId,
      created_at: daysAgo(1),
      prospect_name: "Robert Chen",
      duration_seconds: 1724,
      outcome: "closed",
      overall_score: 8.7,
      disc_profile_detected: "D",
      talk_ratio_agent: 34,
      talk_ratio_prospect: 66,
      objections_raised: [
        { type: "existing_coverage", text: "I already have some through work", handling: "resolved" }
      ],
      nepq_phases_completed: {
        connection:        { score: 9,   note: "Strong rapport established immediately. Referenced mutual contact naturally." },
        situation:         { score: 8,   note: "Uncovered group coverage gap of $50k vs. $800k income replacement need." },
        problemAwareness:  { score: 8.5, note: "Prospect verbalized the gap himself — didn't need to push." },
        consequence:       { score: 8,   note: "Good use of family framing. Could have gone deeper on timeline." },
        solutionAwareness: { score: 9,   note: "Prospect asked for the solution before it was presented." },
        qualifying:        { score: 9,   note: "Budget, health, and decision authority all confirmed cleanly." },
        close:             { score: 8.5, note: "Two-option close worked well. Committed on first ask." },
      },
      coaching_cards_fired: [
        { id: "c1", type: "OBJECTION" },
        { id: "c2", type: "CLOSE_SIGNAL" },
      ],
      cards_accepted: ["c1", "c2"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "This was a strong close. Replicate the two-option framing on every call going forward." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(2),
      prospect_name: "Maria Vasquez",
      duration_seconds: 2482,
      outcome: "not_closed",
      overall_score: 5.2,
      disc_profile_detected: "S",
      talk_ratio_agent: 58,
      talk_ratio_prospect: 42,
      objections_raised: [
        { type: "think_about_it", text: "I need to think about it", handling: "deflected" },
        { type: "spouse",         text: "I have to talk to my husband", handling: "acknowledged" },
        { type: "price",          text: "That's more than I was thinking", handling: "deflected" },
        { type: "timing",         text: "Maybe after the holidays", handling: "ignored" },
      ],
      nepq_phases_completed: {
        connection:        { score: 7,   note: "Good connection but moved too fast — cut off prospect mid-sentence twice." },
        situation:         { score: 6,   note: "Rushed through situation questions. Missed depth on current coverage." },
        problemAwareness:  { score: 5,   note: "Told the prospect they had a problem instead of letting them discover it." },
        consequence:       { score: 4,   note: "Skipped consequence entirely — jumped straight to solution after situation." },
        solutionAwareness: { score: 5,   note: "Presented before prospect was ready. S-type buyer needs more time." },
        qualifying:        { score: 6,   note: "Budget discussed but spouse not involved early enough." },
        close:             { score: 4,   note: "Accepted \"think about it\" without isolating the real objection." },
      },
      coaching_cards_fired: [
        { id: "c3", type: "OBJECTION" },
        { id: "c4", type: "NEPQ_MOVE" },
        { id: "c5", type: "OBJECTION" },
      ],
      cards_accepted: ["c4"],
      cards_dismissed: ["c3"],
      notes: JSON.stringify({ nextCallFocus: "Never accept 'think about it' — always isolate: \"What specifically do you want to think through?\" Practice this response until it's automatic." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(3),
      prospect_name: "James Whitfield",
      duration_seconds: 1998,
      outcome: "closed",
      overall_score: 9.1,
      disc_profile_detected: "I",
      talk_ratio_agent: 31,
      talk_ratio_prospect: 69,
      objections_raised: [
        { type: "price", text: "Is that the best you can do?", handling: "resolved" },
        { type: "timing", text: "Can we start next month?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection:        { score: 10,  note: "Exceptional rapport. Matched I-type energy perfectly." },
        situation:         { score: 9,   note: "Full picture painted. Kids, mortgage, spouse's income all covered." },
        problemAwareness:  { score: 9,   note: "Prospect said: \"I hadn't really thought about what would happen to them.\" Textbook." },
        consequence:       { score: 9,   note: "Strong emotional anchor. Used specific timeline questions effectively." },
        solutionAwareness: { score: 9,   note: "Prospect asked \"so what would that look like?\" before solution was presented." },
        qualifying:        { score: 8.5, note: "Clean qualifying. Health pre-screened naturally." },
        close:             { score: 9.5, note: "Smooth two-option close. Prospect said yes before options were finished." },
      },
      coaching_cards_fired: [
        { id: "c6", type: "DISC_INSIGHT" },
        { id: "c7", type: "CLOSE_SIGNAL" },
        { id: "c8", type: "OBJECTION" },
      ],
      cards_accepted: ["c6", "c7", "c8"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "This call is the benchmark. Study the consequence phase — you used three escalating timeline questions before presenting. That's the pattern." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(4),
      prospect_name: "Diane Park",
      duration_seconds: 1377,
      outcome: "closed",
      overall_score: 7.8,
      disc_profile_detected: "C",
      talk_ratio_agent: 38,
      talk_ratio_prospect: 62,
      objections_raised: [
        { type: "other", text: "How do I know this company is reliable?", handling: "resolved" },
        { type: "other", text: "Can I see the policy documents first?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection:        { score: 8,   note: "Good credibility frame. C-type appreciated the process explanation upfront." },
        situation:         { score: 8,   note: "Thorough discovery. Let prospect ask all her questions." },
        problemAwareness:  { score: 7.5, note: "Data-driven approach worked well for this buyer type." },
        consequence:       { score: 7,   note: "Used numbers effectively but could have added emotional layer." },
        solutionAwareness: { score: 8,   note: "Walked through the mechanics which C-type appreciated." },
        qualifying:        { score: 8.5, note: "Very thorough qualifying — C-type wanted all details before deciding." },
        close:             { score: 8,   note: "Logical close worked. \"Based on the numbers, this is the most efficient option.\"" },
      },
      coaching_cards_fired: [
        { id: "c9",  type: "DISC_INSIGHT" },
        { id: "c10", type: "OBJECTION" },
      ],
      cards_accepted: ["c9", "c10"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "For C-types, lead with carrier AM Best ratings and policy structure early. They're deciding on trust before they're deciding on price." }),
    },

    // ── Week 2 ───────────────────────────────────────────────────────
    {
      agent_id: agentId,
      created_at: daysAgo(7),
      prospect_name: "Tony Okafor",
      duration_seconds: 2831,
      outcome: "not_closed",
      overall_score: 5.9,
      disc_profile_detected: "D",
      talk_ratio_agent: 61,
      talk_ratio_prospect: 39,
      objections_raised: [
        { type: "think_about_it", text: "Let me think it over this week", handling: "ignored" },
        { type: "price",          text: "That's way out of my budget", handling: "deflected" },
        { type: "existing_coverage", text: "My job covers me well enough", handling: "deflected" },
        { type: "timing",         text: "This isn't a good time", handling: "ignored" },
        { type: "spouse",         text: "I need to run this by my wife", handling: "acknowledged" },
      ],
      nepq_phases_completed: {
        connection:        { score: 7,   note: "D-type wanted to get straight to business — you spent too long on rapport." },
        situation:         { score: 5,   note: "Moved through situation in under 3 minutes. Missed critical coverage details." },
        problemAwareness:  { score: 5.5, note: "Presented features before the problem was fully acknowledged." },
        consequence:       { score: 4,   note: "Consequence phase was skipped entirely. Prospect never felt the urgency." },
        solutionAwareness: { score: 5,   note: "Jumped to product presentation too early — lost D-type's interest." },
        qualifying:        { score: 6,   note: "Budget objection surfaced late because qualifying happened after pitching." },
        close:             { score: 5,   note: "Talked too much at the close. D-types need a direct ask, not a presentation." },
      },
      coaching_cards_fired: [
        { id: "c11", type: "NEPQ_MOVE" },
        { id: "c12", type: "OBJECTION" },
        { id: "c13", type: "NEPQ_MOVE" },
        { id: "c14", type: "OBJECTION" },
      ],
      cards_accepted: ["c11"],
      cards_dismissed: ["c12", "c14"],
      notes: JSON.stringify({ nextCallFocus: "Talk ratio was 61% — you ran a presentation, not a sales call. On your next call, set a timer: if you've talked for 30 seconds without asking a question, stop and ask one." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(8),
      prospect_name: "Natalie Ford",
      duration_seconds: 2200,
      outcome: "closed",
      overall_score: 8.1,
      disc_profile_detected: "S",
      talk_ratio_agent: 36,
      talk_ratio_prospect: 64,
      objections_raised: [
        { type: "spouse",         text: "I'd want to involve my husband in this decision", handling: "resolved" },
        { type: "think_about_it", text: "Can I sleep on it?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection:        { score: 8.5, note: "Perfect pace for S-type. Took time, built real trust." },
        situation:         { score: 8,   note: "Family-first framing resonated. Uncovered 3 dependents and a mortgage." },
        problemAwareness:  { score: 8,   note: "\"What does your family do financially if you're not there?\" landed hard." },
        consequence:       { score: 7.5, note: "Good emotional anchoring. Prospect teared up — genuine connection." },
        solutionAwareness: { score: 8,   note: "\"So you'd want something permanent then\" was a perfect bridge." },
        qualifying:        { score: 8,   note: "Proactively suggested getting husband on the call — smart move." },
        close:             { score: 8.5, note: "Didn't rush. Gave her space to decide. She came back with yes." },
      },
      coaching_cards_fired: [
        { id: "c15", type: "DISC_INSIGHT" },
        { id: "c16", type: "OBJECTION" },
        { id: "c17", type: "CLOSE_SIGNAL" },
      ],
      cards_accepted: ["c15", "c16", "c17"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "S-type playbook worked perfectly here. Remember: never rush S-types. Silence is comfort, not hesitation." }),
    },

    // ── Week 3 ───────────────────────────────────────────────────────
    {
      agent_id: agentId,
      created_at: daysAgo(14),
      prospect_name: "Carl Bennett",
      duration_seconds: 3258,
      outcome: "not_closed",
      overall_score: 6.4,
      disc_profile_detected: "C",
      talk_ratio_agent: 44,
      talk_ratio_prospect: 56,
      objections_raised: [
        { type: "other",  text: "I want to compare this with other carriers", handling: "acknowledged" },
        { type: "price",  text: "The premium is higher than I expected", handling: "deflected" },
        { type: "timing", text: "Give me a few weeks to research", handling: "acknowledged" },
      ],
      nepq_phases_completed: {
        connection:        { score: 8,   note: "Strong start. C-type appreciated the structured intro." },
        situation:         { score: 7,   note: "Good but missed asking about existing policies in detail." },
        problemAwareness:  { score: 7,   note: "Presented data points well but missed emotional layer." },
        consequence:       { score: 5.5, note: "Consequence phase was weak — too logical, not visceral enough even for a C-type." },
        solutionAwareness: { score: 6,   note: "Moved to solution before prospect asked for it." },
        qualifying:        { score: 6.5, note: "Didn't address comparison-shopping objection proactively." },
        close:             { score: 6,   note: "C-type needed more data. Should have offered a written comparison." },
      },
      coaching_cards_fired: [
        { id: "c18", type: "NEPQ_MOVE" },
        { id: "c19", type: "OBJECTION" },
      ],
      cards_accepted: ["c18"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "For C-types who want to compare: offer to do the comparison WITH them. \"I can pull up two other options right now — let's look at them together.\" Takes away the reason to leave." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(15),
      prospect_name: "Sharon Miles",
      duration_seconds: 1773,
      outcome: "closed",
      overall_score: 9.2,
      disc_profile_detected: "S",
      talk_ratio_agent: 29,
      talk_ratio_prospect: 71,
      objections_raised: [
        { type: "existing_coverage", text: "We have a small policy but I'm not sure of the amount", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection:        { score: 9.5, note: "Best connection phase this month. Prospect was sharing personal details within 2 minutes." },
        situation:         { score: 9,   note: "Uncovered underfunded group policy and two school-age kids." },
        problemAwareness:  { score: 9.5, note: "Prospect said: \"I've never actually thought about what would happen.\" Perfect setup." },
        consequence:       { score: 9,   note: "\"How long could your family stay in the house?\" — devastating and effective." },
        solutionAwareness: { score: 9,   note: "Prospect was asking for options before consequence phase was even finished." },
        qualifying:        { score: 9,   note: "Health and budget cleared naturally in conversation." },
        close:             { score: 9.5, note: "Committed in under 30 seconds. One of the cleanest closes on record." },
      },
      coaching_cards_fired: [
        { id: "c20", type: "OBJECTION" },
        { id: "c21", type: "CLOSE_SIGNAL" },
      ],
      cards_accepted: ["c20", "c21"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Talk ratio 29% — exceptional. This is what every call should look like. The prospect closed herself." }),
    },

    // ── Week 4 ───────────────────────────────────────────────────────
    {
      agent_id: agentId,
      created_at: daysAgo(20),
      prospect_name: "Kevin Yuen",
      duration_seconds: 2339,
      outcome: "closed",
      overall_score: 7.1,
      disc_profile_detected: "I",
      talk_ratio_agent: 41,
      talk_ratio_prospect: 59,
      objections_raised: [
        { type: "think_about_it", text: "This is a lot to take in, I need to process it", handling: "resolved" },
        { type: "spouse",         text: "My partner would want to know about this", handling: "resolved" },
        { type: "price",          text: "Monthly payments add up", handling: "acknowledged" },
      ],
      nepq_phases_completed: {
        connection:        { score: 8,   note: "Good energy match with I-type prospect." },
        situation:         { score: 7,   note: "Decent but rushed the family situation questions." },
        problemAwareness:  { score: 7,   note: "Problem surfaced but could have been sharper." },
        consequence:       { score: 6,   note: "Consequence phase too short. I-type needed more emotional story." },
        solutionAwareness: { score: 7,   note: "Transition to solution was smooth." },
        qualifying:        { score: 7.5, note: "Partner involvement handled well on second attempt." },
        close:             { score: 7,   note: "Closed but required two attempts. First ask was too soft." },
      },
      coaching_cards_fired: [
        { id: "c22", type: "NEPQ_MOVE" },
        { id: "c23", type: "OBJECTION" },
        { id: "c24", type: "DISC_INSIGHT" },
      ],
      cards_accepted: ["c22", "c23"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "I-types buy on story and legacy. Practice: \"Imagine your kids looking back years from now knowing you had this handled for them.\" This is the close for I-types." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(21),
      prospect_name: "Patricia Lowry",
      duration_seconds: 1502,
      outcome: "not_closed",
      overall_score: 6.8,
      disc_profile_detected: "D",
      talk_ratio_agent: 47,
      talk_ratio_prospect: 53,
      objections_raised: [
        { type: "timing", text: "I'm in the middle of something, call me back", handling: "acknowledged" },
        { type: "other",  text: "My accountant handles all of this", handling: "deflected" },
      ],
      nepq_phases_completed: {
        connection:        { score: 7,   note: "D-type wanted to skip small talk. You obliged — good instinct." },
        situation:         { score: 7,   note: "Efficient situation questions — appropriate for D-type." },
        problemAwareness:  { score: 6,   note: "Good framing but prospect not fully engaged." },
        consequence:       { score: 6.5, note: "Consequence was direct but prospect deflected to accountant." },
        solutionAwareness: { score: 7,   note: "Solution presented cleanly and concisely." },
        qualifying:        { score: 7,   note: "Budget not fully established before presentation." },
        close:             { score: 6,   note: "Accountant objection needed a sharper response. Should have isolated it." },
      },
      coaching_cards_fired: [
        { id: "c25", type: "OBJECTION" },
        { id: "c26", type: "NEPQ_MOVE" },
      ],
      cards_accepted: ["c25"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "\"My accountant handles this\" is a trust objection, not a referral. Respond: \"That makes sense — is there a concern about the product itself, or is it more about having a second opinion?\" Isolate before moving on." }),
    },

    // ── Month 2 (older) ───────────────────────────────────────────────
    {
      agent_id: agentId,
      created_at: daysAgo(28),
      prospect_name: "Marcus Webb",
      duration_seconds: 2100,
      outcome: "closed",
      overall_score: 7.5,
      disc_profile_detected: "I",
      talk_ratio_agent: 39,
      talk_ratio_prospect: 61,
      objections_raised: [
        { type: "price", text: "Can we find something more affordable?", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection:        { score: 8,   note: "Great energy." },
        situation:         { score: 7.5, note: "Good family discovery." },
        problemAwareness:  { score: 7,   note: "Problem well articulated." },
        consequence:       { score: 7,   note: "Solid consequence work." },
        solutionAwareness: { score: 7.5, note: "Clean transition." },
        qualifying:        { score: 8,   note: "Budget handled well." },
        close:             { score: 8,   note: "Clean close on second option." },
      },
      coaching_cards_fired: [{ id: "c27", type: "OBJECTION" }],
      cards_accepted: ["c27"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Solid all-around call. Focus on deepening consequence phase — you're leaving emotional urgency on the table." }),
    },
    {
      agent_id: agentId,
      created_at: daysAgo(30),
      prospect_name: "Linda Castillo",
      duration_seconds: 1850,
      outcome: "closed",
      overall_score: 8.3,
      disc_profile_detected: "S",
      talk_ratio_agent: 33,
      talk_ratio_prospect: 67,
      objections_raised: [
        { type: "spouse", text: "My husband would want to know about this", handling: "resolved" },
      ],
      nepq_phases_completed: {
        connection:        { score: 9,   note: "Strong family connection built." },
        situation:         { score: 8,   note: "Full situation picture." },
        problemAwareness:  { score: 8,   note: "Prospect self-identified the gap." },
        consequence:       { score: 8,   note: "Good emotional consequence work." },
        solutionAwareness: { score: 8,   note: "Natural transition." },
        qualifying:        { score: 8.5, note: "Spouse looped in proactively." },
        close:             { score: 8.5, note: "Confident close." },
      },
      coaching_cards_fired: [
        { id: "c28", type: "DISC_INSIGHT" },
        { id: "c29", type: "CLOSE_SIGNAL" },
      ],
      cards_accepted: ["c28", "c29"],
      cards_dismissed: [],
      notes: JSON.stringify({ nextCallFocus: "Great call. Your S-type playbook is dialed in — use this as a model for family-focused prospects." }),
    },
  ];
}

// ─── Agent profile aggregation ────────────────────────────────────────────────

function buildAgentProfile(agentId: string) {
  return {
    agent_id:               agentId,
    updated_at:             new Date().toISOString(),
    total_calls:            12,
    close_rate:             0.583,           // 7/12
    avg_talk_ratio:         40.1,
    avg_overall_score:      7.68,
    most_common_disc_type:  "S",
    weak_nepq_phases:       ["consequence"],
    strong_nepq_phases:     ["connection", "close"],
    most_missed_objections: ["think_about_it", "price"],
    most_accepted_card_types: ["OBJECTION", "CLOSE_SIGNAL", "DISC_INSIGHT"],
    last_5_outcomes:        ["closed", "not_closed", "closed", "closed", "not_closed"],
    coaching_focus:         "Your consequence phase is holding back your close rate. Practice the cost-of-inaction sequence until it's automatic on every call.",
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Protect with admin secret
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId: string;
  try {
    ({ userId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const db = createServiceClient();

  // Check user exists
  const { data: userData, error: userErr } = await db.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Clear any existing demo data for this user
  await db.from("call_sessions").delete().eq("agent_id", userId);
  await db.from("agent_profiles").delete().eq("agent_id", userId);

  // Insert demo call sessions
  const calls = buildDemoCalls(userId);
  const { error: callsErr } = await db.from("call_sessions").insert(calls);
  if (callsErr) {
    console.error("[seed-demo] call_sessions insert error:", callsErr);
    return NextResponse.json({ error: callsErr.message }, { status: 500 });
  }

  // Upsert agent profile
  const { error: profileErr } = await db
    .from("agent_profiles")
    .upsert(buildAgentProfile(userId), { onConflict: "agent_id" });
  if (profileErr) {
    console.error("[seed-demo] agent_profiles upsert error:", profileErr);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  console.log(`[seed-demo] Seeded ${calls.length} calls for user ${userId}`);
  return NextResponse.json({
    success: true,
    userId,
    callsSeeded: calls.length,
    message: `Demo data ready for ${userData.user.email}`,
  });
}
