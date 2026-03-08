import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const openaiKey = requireEnv("OPENAI_API_KEY");
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // Timeline (MVP: première)
    const { data: timelines, error: tErr } = await supabaseAuthed
      .from("timelines")
      .select("id,title")
      .limit(1);

    if (tErr || !timelines?.[0]) {
      return NextResponse.json({ error: tErr?.message || "Timeline not found" }, { status: 400 });
    }

    const timelineId = timelines[0].id as string;

    // Charger sources
    const [{ data: periods }, { data: events }, { data: memories }, { data: existingPeople }] =
      await Promise.all([
        supabaseAuthed.from("periods").select("id,start_date,end_date,place,people,notes").eq("timeline_id", timelineId),
        supabaseAuthed.from("events").select("id,event_date,event_type,title,place,people,notes").eq("timeline_id", timelineId),
        supabaseAuthed.from("memories").select("id,occurred_on,title,content").eq("timeline_id", timelineId),
        supabaseAuthed.from("people").select("id,display_name").eq("timeline_id", timelineId),
      ]);

    const existing = new Set((existingPeople ?? []).map((p: any) => normName(p.display_name)));

    // Préparer un "corpus" compact (on évite d’envoyer tout le texte brut si énorme)
    const payload = {
      periods: (periods ?? []).map((p: any) => ({
        id: p.id,
        start_date: p.start_date,
        end_date: p.end_date,
        place: p.place,
        people: p.people,
        notes: p.notes,
      })),
      events: (events ?? []).map((e: any) => ({
        id: e.id,
        event_date: e.event_date,
        event_type: e.event_type,
        title: e.title,
        place: e.place,
        people: e.people,
        notes: e.notes,
      })),
      memories: (memories ?? []).map((m: any) => ({
        id: m.id,
        occurred_on: m.occurred_on,
        title: m.title,
        // on envoie le contenu, mais tu peux tronquer si besoin
        content: m.content,
      })),
      instructions: {
        language: "fr-FR",
        goal: "Extraire des personnes mentionnées (noms propres de personnes) à valider par l'utilisateur.",
        rules: [
          "Ne pas inclure des lieux, entreprises, pays, événements.",
          "Ne pas inventer de personnes.",
          "Si doute, ne pas inclure.",
          "Retourner une liste dédoublonnée."
        ],
      },
    };

    // JSON schema de sortie
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        candidates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              display_name: { type: "string" },
              sources: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    source_type: { type: "string", enum: ["period", "event", "memory"] },
                    source_id: { type: "string" },
                    excerpt: { type: "string" }
                  },
                  required: ["source_type", "source_id", "excerpt"]
                }
              }
            },
            required: ["display_name", "sources"]
          }
        }
      },
      required: ["candidates"]
    };

    const prompt = `
Tu es un assistant d'extraction d'entités nommées.
Tu dois extraire UNIQUEMENT des personnes (humains) mentionnées dans les données.

Contraintes:
- Ne pas inclure des lieux, organisations, marques, pays.
- Ne pas inventer.
- Si tu hésites, n'inclus pas.
- Dédoublonne (même personne => une seule entrée).
- IMPORTANT: si deux prénoms apparaissent côte à côte sans nom de famille (ex: "Paul Pierre"),
  propose les deux prénoms indépendemment et composé (ex: Paul, Pierre et Paul-Pierre)
- Pour chaque personne, fournis quelques sources avec un petit extrait (excerpt).
`.trim();

    const oaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "user", content: [{ type: "input_text", text: prompt }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(payload) }] },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "people_scan",
            schema,
            strict: true
          }
        }
      }),
    });

    if (!oaiRes.ok) {
      const txt = await oaiRes.text();
      return NextResponse.json({ error: "OpenAI error", detail: txt }, { status: 502 });
    }

    const oaiJson = await oaiRes.json();

    const outputText =
      oaiJson.output_text ||
      (Array.isArray(oaiJson.output)
        ? oaiJson.output
            .flatMap((o: any) => o.content || [])
            .map((c: any) => c.text)
            .filter(Boolean)
            .join("\n")
        : null);

    let parsed: any = null;
    try {
      parsed = typeof outputText === "string" ? JSON.parse(outputText) : null;
    } catch {
      parsed =
        Array.isArray(oaiJson.output)
          ? oaiJson.output
              .flatMap((o: any) => o.content || [])
              .map((c: any) => c.parsed)
              .find((p: any) => p && typeof p === "object")
          : null;
    }

    if (!parsed?.candidates) {
      return NextResponse.json({ error: "Failed to parse JSON candidates" }, { status: 502 });
    }

    // Filtrer candidats déjà existants + normaliser
    const candidates = (parsed.candidates as any[])
      .map((c) => ({
        display_name: String(c.display_name || "").trim(),
        norm: normName(String(c.display_name || "")),
        sources: Array.isArray(c.sources) ? c.sources.slice(0, 6) : [],
      }))
      .filter((c) => c.display_name && c.norm && !existing.has(c.norm));

    // Dédoublonnage par norm
    const byNorm = new Map<string, any>();
    for (const c of candidates) {
      if (!byNorm.has(c.norm)) byNorm.set(c.norm, { display_name: c.display_name, sources: c.sources });
      else {
        const prev = byNorm.get(c.norm);
        prev.sources = [...prev.sources, ...c.sources].slice(0, 8);
      }
    }

    return NextResponse.json({ timeline_id: timelineId, candidates: Array.from(byNorm.values()) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
