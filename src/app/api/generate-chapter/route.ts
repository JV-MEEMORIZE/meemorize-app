import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // important (OpenAI + fetch)

type ScopeType = "period" | "event";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function buildPrompt(params: {
  scopeType: ScopeType;
  scope: any;
  memories: Array<{ id: string; title: string | null; content: string; occurred_on: string | null }>;
  prefs: { chapter_length_words: number; historical_enrichment: "off" | "discret" | "moyen"; style: "sobre" | "chaleureux" | "romance_leger" };
}) {
  const { scopeType, scope, memories, prefs } = params;

  const styleText =
    prefs.style === "sobre"
      ? "Style sobre: phrases simples, ton clair, peu d'adjectifs, pas de grandiloquence."
      : prefs.style === "chaleureux"
      ? "Style chaleureux: émotion juste, proximité, mais phrases simples et lisibles."
      : "Style romancé léger: rythme et scènes, mais sans inventer de faits personnels.";

  const histText =
    prefs.historical_enrichment === "off"
      ? "N'ajoute aucun contexte historique."
      : prefs.historical_enrichment === "discret"
      ? "Ajoute un contexte historique discret: 1 à 2 encadrés courts maximum, séparés dans le champ historical_context."
      : "Ajoute un contexte historique moyen: 3 à 5 points maximum, séparés dans le champ historical_context.";

  const targetText =
    scopeType === "event"
      ? `ÉVÉNEMENT:
- date: ${scope.event_date ?? ""}
- type: ${scope.event_type ?? ""}
- titre: ${scope.title ?? ""}
- lieu: ${scope.place ?? ""}
- personnes: ${scope.people ?? ""}
- notes: ${scope.notes ?? ""}`
      : `PÉRIODE:
- début: ${scope.start_date ?? ""}
- fin: ${scope.end_date ?? ""}
- lieu: ${scope.place ?? ""}
- personnes: ${scope.people ?? ""}
- situation: ${scope.situation ?? ""}
- notes: ${scope.notes ?? ""}`;

  const memoriesText = memories
    .map(
      (m) =>
        `- id: ${m.id}\n  date: ${m.occurred_on ?? ""}\n  titre: ${m.title ?? ""}\n  contenu: ${m.content}`
    )
    .join("\n");

  return `
Tu es un écrivain biographique. Tu écris à la première personne ("je"), en français.
Règles absolues:
- N'invente aucun fait personnel. Ne comble pas les trous.
- Si une info manque, pose une question ouverte dans open_questions_for_mee.
- Sépare strictement ce qui est "contexte historique" dans historical_context (et n'écris pas le contexte historique comme si "je" l'avais vécu).
- Le texte doit être lisible par la famille: paragraphes courts, pas de clichés, émotion juste.
- Longueur: vise ~${prefs.chapter_length_words} mots (tolérance ±10%).
- ${styleText}
- ${histText}

${targetText}

SOUVENIRS LIÉS (matière brute):
${memoriesText}
`.trim();
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const openaiKey = requireEnv("OPENAI_API_KEY");
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });
    }

    const body = await req.json();
    const scopeType: ScopeType = body.scopeType;
    const scopeId: string = body.scopeId;

    if (!scopeType || !scopeId || (scopeType !== "period" && scopeType !== "event")) {
      return NextResponse.json({ error: "Invalid body. Expected { scopeType: 'period'|'event', scopeId }" }, { status: 400 });
    }

    // Validate user token with Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    // Create an authed client for DB reads with RLS
    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Get timeline (first one)
    const { data: timelines, error: tErr } = await supabaseAuthed
      .from("timelines")
      .select("id,title")
      .limit(1);

    if (tErr || !timelines?.[0]) {
      return NextResponse.json({ error: tErr?.message || "Timeline not found" }, { status: 400 });
    }
    const timelineId = timelines[0].id as string;

    // Get prefs (must exist)
    const { data: prefsRow, error: pErr } = await supabaseAuthed
      .from("writing_preferences")
      .select("owner_id,chapter_length_words,historical_enrichment,style")
      .eq("owner_id", userId)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 400 });
    }
    if (!prefsRow) {
      return NextResponse.json({ error: "MISSING_PREFS", message: "Writing preferences not set" }, { status: 409 });
    }

    const prefs = {
      chapter_length_words: prefsRow.chapter_length_words as number,
      historical_enrichment: prefsRow.historical_enrichment as "off" | "discret" | "moyen",
      style: prefsRow.style as "sobre" | "chaleureux" | "romance_leger",
    };

    // Get scope data + memories linked
    let scope: any = null;
    let memories: any[] = [];

    if (scopeType === "period") {
      const { data: pRow, error } = await supabaseAuthed
        .from("periods")
        .select("id,timeline_id,start_date,end_date,place,people,situation,notes")
        .eq("id", scopeId)
        .maybeSingle();
      if (error || !pRow) return NextResponse.json({ error: error?.message || "Period not found" }, { status: 404 });
      scope = pRow;

      const { data: mems, error: mErr } = await supabaseAuthed
        .from("memories")
        .select("id,title,content,occurred_on")
        .eq("timeline_id", timelineId)
        .eq("period_id", scopeId)
        .order("created_at", { ascending: true });

      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
      memories = mems ?? [];
    } else {
      const { data: eRow, error } = await supabaseAuthed
        .from("events")
        .select("id,timeline_id,event_date,event_type,title,place,people,notes")
        .eq("id", scopeId)
        .maybeSingle();
      if (error || !eRow) return NextResponse.json({ error: error?.message || "Event not found" }, { status: 404 });
      scope = eRow;

      const { data: mems, error: mErr } = await supabaseAuthed
        .from("memories")
        .select("id,title,content,occurred_on")
        .eq("timeline_id", timelineId)
        .eq("event_id", scopeId)
        .order("created_at", { ascending: true });

      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
      memories = mems ?? [];
    }

    // Build prompt
    const prompt = buildPrompt({ scopeType, scope, memories, prefs });

    // --- OpenAI Responses API (Structured Outputs / JSON schema) ---
    const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    chapter_title: { type: "string" },
    chapter_text: { type: "string" },
    chapter_summary: { type: "string" },
    historical_context: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          content: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["label", "content", "confidence"],
      },
    },
    open_questions_for_mee: { type: "array", items: { type: "string" } },
    sensitive_points_to_confirm: { type: "array", items: { type: "string" } },
    source_memory_ids_used: { type: "array", items: { type: "string" } },
  },
  required: [
    "chapter_title",
    "chapter_text",
    "chapter_summary",
    "historical_context",
    "open_questions_for_mee",
    "sensitive_points_to_confirm",
    "source_memory_ids_used",
  ],
};

    const oaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
  model,
  input: [
    {
      role: "user",
      content: [{ type: "input_text", text: prompt }],
    },
  ],
  text: {
  format: {
    type: "json_schema",
    name: "meemorize_chapter",
    schema: schema, // on passe le schéma ici
  },
},
}),
    });

    if (!oaiRes.ok) {
      const txt = await oaiRes.text();
      return NextResponse.json({ error: "OpenAI error", detail: txt }, { status: 502 });
    }

    const oaiJson = await oaiRes.json();

    // The structured JSON is typically in output_text for Responses; we parse safely:
    // We'll try to find the first JSON object in output.
    let parsed: any = null;

    // Common path: oaiJson.output[...].content[...].text
    // We'll fallback to oaiJson.output_text if present.
    const outputText =
      oaiJson.output_text ||
      (Array.isArray(oaiJson.output)
        ? oaiJson.output
            .flatMap((o: any) => o.content || [])
            .map((c: any) => c.text)
            .filter(Boolean)
            .join("\n")
        : null);

    try {
      parsed = typeof outputText === "string" ? JSON.parse(outputText) : null;
    } catch {
      // Sometimes SDK returns already-parsed JSON in oaiJson.output[...].content[...].parsed
      const maybeParsed =
        Array.isArray(oaiJson.output)
          ? oaiJson.output
              .flatMap((o: any) => o.content || [])
              .map((c: any) => c.parsed)
              .find((p: any) => p && typeof p === "object")
          : null;
      parsed = maybeParsed;
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Failed to parse structured JSON from OpenAI response" }, { status: 502 });
    }

    // Insert chapter in DB (draft)
    const insertPayload: any = {
      timeline_id: timelineId,
      period_id: scopeType === "period" ? scopeId : null,
      event_id: scopeType === "event" ? scopeId : null,
      chapter_title: parsed.chapter_title ?? null,
      chapter_text: parsed.chapter_text ?? "",
      chapter_summary: parsed.chapter_summary ?? null,
      ai_json: parsed,
      status: "draft",
    };

    const { data: inserted, error: insErr } = await supabaseAuthed
      .from("chapters")
      .insert(insertPayload)
      .select("id,chapter_title,chapter_text,chapter_summary,status,created_at")
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ chapter: inserted, ai_json: parsed }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
