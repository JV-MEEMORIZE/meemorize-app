import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function GET(req: Request) {
  try {
    const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Missing Authorization Bearer token" }, { status: 401 });

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // 1) Timeline (MVP: première timeline du user)
    const { data: timelines, error: tErr } = await supabase
      .from("timelines")
      .select("id,title")
      .order("created_at", { ascending: true })
      .limit(1);

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 400 });
    const t0 = timelines?.[0];
    if (!t0) return NextResponse.json({ error: "Timeline not found" }, { status: 404 });

    const timelineId = t0.id as string;

    // 2) Counts + last chapter + validated chapters (pour aperçu livre)
    const [
      periodsCountRes,
      eventsCountRes,
      memoriesCountRes,
      peopleCountRes,
      chaptersValidatedCountRes,
      lastChapterRes,
      validatedChaptersRes,
    ] = await Promise.all([
      supabase.from("periods").select("id", { count: "exact", head: true }).eq("timeline_id", timelineId),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("timeline_id", timelineId),
      supabase.from("memories").select("id", { count: "exact", head: true }).eq("timeline_id", timelineId),
      supabase.from("people").select("id", { count: "exact", head: true }).eq("timeline_id", timelineId),
      supabase
        .from("chapters")
        .select("id", { count: "exact", head: true })
        .eq("timeline_id", timelineId)
        .eq("status", "validated"),
      supabase
        .from("chapters")
        .select("id,period_id,event_id,chapter_title,chapter_text,status,created_at")
        .eq("timeline_id", timelineId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("chapters")
        .select("id,period_id,event_id,chapter_title,chapter_text,status,created_at")
        .eq("timeline_id", timelineId)
        .eq("status", "validated")
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    // check errors
    const anyErr =
      periodsCountRes.error ||
      eventsCountRes.error ||
      memoriesCountRes.error ||
      peopleCountRes.error ||
      chaptersValidatedCountRes.error ||
      lastChapterRes.error ||
      validatedChaptersRes.error;

    if (anyErr) {
      return NextResponse.json(
        { error: anyErr.message || "Supabase error" },
        { status: 400 }
      );
    }

    const summary = {
      timeline: { id: timelineId, title: t0.title },
      counts: {
        periods: periodsCountRes.count ?? 0,
        events: eventsCountRes.count ?? 0,
        memories: memoriesCountRes.count ?? 0,
        people: peopleCountRes.count ?? 0,
        chapters_validated: chaptersValidatedCountRes.count ?? 0,
      },
      lastChapter: (lastChapterRes.data?.[0] ?? null),
      validatedChapters: (validatedChaptersRes.data ?? []),
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}