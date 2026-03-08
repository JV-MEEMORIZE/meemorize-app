import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });

    const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = await req.json();
    const timelineId: string = body.timelineId;
    const selected: Array<{ display_name: string; sources: Array<{ source_type: "period"|"event"|"memory"; source_id: string }> }> =
      body.selectedCandidates;

    if (!timelineId || !Array.isArray(selected)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Créer people
    const peopleRows = selected.map((c) => ({
      timeline_id: timelineId,
      display_name: c.display_name.trim(),
    }));

    const { data: insertedPeople, error: pErr } = await supabaseAuthed
      .from("people")
      .insert(peopleRows)
      .select("id,display_name");

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    const idByName = new Map<string, string>();
    (insertedPeople ?? []).forEach((p: any) => idByName.set(p.display_name, p.id));

    // Créer mentions
    const mentionRows: any[] = [];
    for (const c of selected) {
      const personId = idByName.get(c.display_name.trim());
      if (!personId) continue;
      for (const s of (c.sources || [])) {
        mentionRows.push({
          timeline_id: timelineId,
          person_id: personId,
          source_type: s.source_type,
          source_id: s.source_id,
        });
      }
    }

    if (mentionRows.length > 0) {
      const { error: mErr } = await supabaseAuthed.from("person_mentions").insert(mentionRows);
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, created: insertedPeople?.length ?? 0 }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
