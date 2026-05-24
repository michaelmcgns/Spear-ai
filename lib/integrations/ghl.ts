import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

// ─── Encryption helpers ───────────────────────────────────────────────────────

const ENC_KEY = process.env.GHL_ENCRYPTION_KEY ?? "";

function encrypt(text: string): string {
  if (!ENC_KEY) return text;
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENC_KEY, "salt", 32);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text: string): string {
  if (!ENC_KEY || !text.includes(":")) return text;
  const [ivHex, encHex] = text.split(":");
  const key = crypto.scryptSync(ENC_KEY, "salt", 32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

// ─── Credential management ────────────────────────────────────────────────────

export interface GHLCredentials {
  apiKey: string;
  locationId: string;
}

export async function getGHLCredentials(agentId: string): Promise<GHLCredentials | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agent_integrations")
    .select("ghl_api_key_enc, ghl_location_id")
    .eq("agent_id", agentId)
    .single();

  if (!data?.ghl_api_key_enc) return null;
  return {
    apiKey: decrypt(data.ghl_api_key_enc),
    locationId: data.ghl_location_id ?? "",
  };
}

export async function saveGHLCredentials(agentId: string, apiKey: string, locationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("agent_integrations").upsert(
    {
      agent_id: agentId,
      ghl_api_key_enc: encrypt(apiKey),
      ghl_location_id: locationId,
      ghl_connected_at: new Date().toISOString(),
      ghl_last_sync_at: null,
    },
    { onConflict: "agent_id" }
  );
}

export async function removeGHLCredentials(agentId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("agent_integrations").upsert(
    {
      agent_id: agentId,
      ghl_api_key_enc: null,
      ghl_location_id: null,
      ghl_connected_at: null,
      ghl_last_sync_at: null,
    },
    { onConflict: "agent_id" }
  );
}

// ─── GHL API helpers ──────────────────────────────────────────────────────────

const GHL_BASE = "https://rest.gohighlevel.com/v1";

function ghlHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function validateGHLKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/?limit=1`, {
      headers: ghlHeaders(apiKey),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findContactByPhone(apiKey: string, phone: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(phone);
    const res = await fetch(`${GHL_BASE}/contacts/?phone=${encoded}`, {
      headers: ghlHeaders(apiKey),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.contacts?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function createGHLContact(
  apiKey: string,
  locationId: string,
  name: string,
  phone: string,
  fields: Record<string, string>
): Promise<string | null> {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/`, {
      method: "POST",
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({
        locationId,
        firstName: name.split(" ")[0] ?? name,
        lastName: name.split(" ").slice(1).join(" ") || undefined,
        phone,
        customField: buildCustomFields(fields),
        tags: ["spear-ai"],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.contact?.id ?? null;
  } catch {
    return null;
  }
}

async function updateGHLContact(
  apiKey: string,
  contactId: string,
  fields: Record<string, string>
): Promise<boolean> {
  try {
    const res = await fetch(`${GHL_BASE}/contacts/${contactId}`, {
      method: "PUT",
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({ customField: buildCustomFields(fields) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function addGHLNote(apiKey: string, contactId: string, body: string): Promise<void> {
  try {
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes/`, {
      method: "POST",
      headers: ghlHeaders(apiKey),
      body: JSON.stringify({ body }),
    });
  } catch {
    // Non-fatal
  }
}

function buildCustomFields(fields: Record<string, string>) {
  return Object.entries(fields).map(([key, value]) => ({ key, field_value: value }));
}

// ─── Pipeline stage automation ────────────────────────────────────────────────

async function moveToPipelineStage(
  apiKey: string,
  locationId: string,
  contactId: string,
  outcome: string
): Promise<void> {
  const stageMap: Record<string, string[]> = {
    closed:     ["Closed Won", "Closed"],
    follow_up:  ["Follow Up", "Nurture"],
    not_closed: ["Dead", "Lost"],
  };
  const targetStages = stageMap[outcome] ?? [];
  if (!targetStages.length) return;

  try {
    const pipelinesRes = await fetch(`${GHL_BASE}/pipelines/?locationId=${locationId}`, {
      headers: ghlHeaders(apiKey),
    });
    if (!pipelinesRes.ok) return;
    const pipelinesJson = await pipelinesRes.json();
    const pipelines: { id: string; stages: { id: string; name: string }[] }[] = pipelinesJson?.pipelines ?? [];

    for (const pipeline of pipelines) {
      const stage = pipeline.stages?.find(s =>
        targetStages.some(t => s.name.toLowerCase().includes(t.toLowerCase()))
      );
      if (!stage) continue;

      // Check if opportunity exists for this contact
      const oppRes = await fetch(
        `${GHL_BASE}/opportunities/search/?location_id=${locationId}&contact_id=${contactId}`,
        { headers: ghlHeaders(apiKey) }
      );
      if (!oppRes.ok) continue;
      const oppJson = await oppRes.json();
      const opp = oppJson?.opportunities?.[0];

      if (opp) {
        await fetch(`${GHL_BASE}/opportunities/${opp.id}`, {
          method: "PUT",
          headers: ghlHeaders(apiKey),
          body: JSON.stringify({ stageId: stage.id }),
        });
      } else {
        await fetch(`${GHL_BASE}/opportunities/`, {
          method: "POST",
          headers: ghlHeaders(apiKey),
          body: JSON.stringify({
            pipelineId: pipeline.id,
            locationId,
            contactId,
            name: "Spear AI — Life Insurance",
            stageId: stage.id,
          }),
        });
      }
      break;
    }
  } catch {
    // Non-fatal — pipeline move is best-effort
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export interface SpearCallData {
  agentId: string;
  callSessionId: string | number;
  prospectName: string;
  prospectPhone: string;
  overallScore: number | null;
  discProfile: string | null;
  nepqPhaseReached: string | null;
  outcome: "closed" | "not_closed" | "follow_up" | "unknown";
  objectionsRaised: string[];
  topImprovement: string | null;
  topStrength: string | null;
  callDate: string;
  siteUrl: string;
}

export async function syncCallToGHL(data: SpearCallData): Promise<{ success: boolean; error?: string }> {
  const creds = await getGHLCredentials(data.agentId);
  if (!creds) return { success: false, error: "GHL not connected" };

  const { apiKey, locationId } = creds;

  // 1. Match or create contact
  let contactId = data.prospectPhone
    ? await findContactByPhone(apiKey, data.prospectPhone)
    : null;

  const customFields: Record<string, string> = {
    spear_call_score:        data.overallScore?.toString() ?? "",
    spear_disc_profile:      data.discProfile ?? "",
    spear_nepq_phase_reached: data.nepqPhaseReached ?? "",
    spear_call_outcome:      outcomeLabel(data.outcome),
    spear_objections_raised: data.objectionsRaised.join(", "),
    spear_top_improvement:   data.topImprovement ?? "",
    spear_last_call_date:    data.callDate,
  };

  if (contactId) {
    await updateGHLContact(apiKey, contactId, customFields);
  } else if (data.prospectPhone) {
    contactId = await createGHLContact(apiKey, locationId, data.prospectName, data.prospectPhone, customFields);
  }

  if (!contactId) return { success: false, error: "Could not match or create GHL contact" };

  // 2. Add activity note
  const noteBody = [
    `📊 Spear AI Call Analysis — ${new Date(data.callDate).toLocaleDateString()}`,
    `Score: ${data.overallScore ?? "N/A"}/10 | DISC: ${data.discProfile ?? "N/A"} | Outcome: ${outcomeLabel(data.outcome)}`,
    `Top strength: ${data.topStrength ?? "—"}`,
    `Top improvement: ${data.topImprovement ?? "—"}`,
    `NEPQ phase reached: ${data.nepqPhaseReached ?? "—"}`,
    `Full report: ${data.siteUrl}/dashboard?call=${data.callSessionId}`,
  ].join("\n");

  await addGHLNote(apiKey, contactId, noteBody);

  // 3. Move pipeline stage
  await moveToPipelineStage(apiKey, locationId, contactId, data.outcome);

  // 4. Update last sync timestamp
  const supabase = await createClient();
  await supabase
    .from("agent_integrations")
    .update({ ghl_last_sync_at: new Date().toISOString() })
    .eq("agent_id", data.agentId);

  return { success: true };
}

function outcomeLabel(outcome: string): string {
  const map: Record<string, string> = {
    closed: "Closed", not_closed: "Not Closed", follow_up: "Follow Up", unknown: "Unknown",
  };
  return map[outcome] ?? outcome;
}
