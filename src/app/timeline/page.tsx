"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import AppNav from "@/components/AppNav";

type Timeline = { id: string; title: string };

type Period = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  place: string | null;
  people: string | null;
  situation: string | null;
  notes: string | null;
};

type LifeEvent = {
  id: string;
  event_date: string | null;
  event_type: string | null;
  title: string | null;
  place: string | null;
  people: string | null;
  notes: string | null;
};

type ChronoItem =
  | { kind: "period"; sortDate: string; data: Period }
  | { kind: "event"; sortDate: string; data: LifeEvent };

export default function TimelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);

  const recognitionRef = useRef<any>(null);
  const lastFinalChunkRef = useRef<string>("");
  const dictationSessionRef = useRef<string>("");

  const [isDictating, setIsDictating] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);

  const [autoReadAfterDictation, setAutoReadAfterDictation] = useState(true);

  const COLORS = {
    period: "#2563eb", // bleu
    event: "#f97316",  // orange
  };

  const railStyle: React.CSSProperties = {
    position: "absolute",
    left: 14,
    top: 0,
    bottom: 0,
    width: 2,
    background: "#e5e7eb",
  };

  const itemRowStyle: React.CSSProperties = {
    position: "relative",
    paddingLeft: 38,
  };

  const dotStyle = (kind: "period" | "event"): React.CSSProperties => ({
    position: "absolute",
    left: 6,
    top: 18,
    width: 18,
    height: 18,
    borderRadius: 999,
    background: kind === "period" ? COLORS.period : COLORS.event,
    boxShadow: "0 0 0 4px #fff",
  });

  const cardStyle = (kind: "period" | "event"): React.CSSProperties => ({
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#fff",
    borderLeft: `6px solid ${kind === "period" ? COLORS.period : COLORS.event}`,
  });

  const badgeStyle = (kind: "period" | "event"): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    background: kind === "period" ? "#e8f2ff" : "#fff3e6",
    color: kind === "period" ? "#1e40af" : "#9a3412",
    border: "1px solid #e5e7eb",
  });

  // --------- Form période (form = champs contrôlés) ----------
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [pStartDate, setPStartDate] = useState("");
  const [pEndDate, setPEndDate] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pPeople, setPPeople] = useState("");
  const [pSituation, setPSituation] = useState("");
  const [pNotes, setPNotes] = useState("");

  // --------- Form évènement ----------
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eDate, setEDate] = useState("");
  const [eType, setEType] = useState("");
  const [eTitle, setETitle] = useState("");
  const [ePlace, setEPlace] = useState("");
  const [ePeople, setEPeople] = useState("");
  const [eNotes, setENotes] = useState("");

  // onglet (tab = filtre d’affichage) via URL ?tab=events
  const tab = (searchParams.get("tab") || "all") as "all" | "periods" | "events";

  // chrono (liste triée = fusion + tri)
  const chrono = useMemo<ChronoItem[]>(() => {
    const items: ChronoItem[] = [];

    for (const p of periods) {
      const sortDate = p.start_date || p.end_date || "9999-12-31";
      items.push({ kind: "period", sortDate, data: p });
    }
    for (const e of events) {
      const sortDate = e.event_date || "9999-12-31";
      items.push({ kind: "event", sortDate, data: e });
    }

    items.sort((a, b) => (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0));

    if (tab === "periods") return items.filter((x) => x.kind === "period");
    if (tab === "events") return items.filter((x) => x.kind === "event");
    return items;
  }, [periods, events, tab]);


function parseDateToISO(raw: string): string | null {
  const s0 = (raw || "").toLowerCase().trim();

  // YYYY-MM-DD
  const iso = s0.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]),
      m = Number(iso[2]),
      d = Number(iso[3]);
    if (y >= 1000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // DD/MM/YYYY ou DD-MM-YYYY
  const dmy = s0.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const d = Number(dmy[1]),
      m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (y >= 1000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }



  // "23 mai 2001"
  const s = s0.replace(/^le\s+/, "").replace(/\s+/g, " ").replace(/er\b/, "");
  const months: Record<string, number> = {
    janvier: 1, janv: 1,
    fevrier: 2, février: 2, fev: 2, fév: 2,
    mars: 3,
    avril: 4, avr: 4,
    mai: 5,
    juin: 6,
    juillet: 7, juil: 7,
    aout: 8, août: 8,
    septembre: 9, sept: 9,
    octobre: 10, oct: 10,
    novembre: 11, nov: 11,
    decembre: 12, décembre: 12, dec: 12, déc: 12,
  };

  const parts = s.split(" ");
  if (parts.length >= 3) {
    const d = Number(parts[0]);
    const m = months[parts[1]];
    const y = Number(parts[2]);
    if (y >= 1000 && m && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

function applyDictation(field: string, finalText: string) {
  // ---- dates (conversion = parsing texte → YYYY-MM-DD)
  if (field === "pStartDate") {
    const iso = parseDateToISO(finalText);
    if (!iso) return setDictationError("Date non reconnue. Ex: 23/05/2001, 2001-09-11, 23 mai 2001.");
    setPStartDate(iso);
    return;
  }
  if (field === "pEndDate") {
    const iso = parseDateToISO(finalText);
    if (!iso) return setDictationError("Date non reconnue. Ex: 23/05/2001, 2001-09-11, 23 mai 2001.");
    setPEndDate(iso);
    return;
  }
  if (field === "eDate") {
    const iso = parseDateToISO(finalText);
    if (!iso) return setDictationError("Date non reconnue. Ex: 23/05/2001, 2001-09-11, 23 mai 2001.");
    setEDate(iso);
    return;
  }

  // ---- période (champs texte)
  if (field === "pPlace") return setPPlace(finalText);
  if (field === "pPeople") return setPPeople(finalText);
  if (field === "pSituation") return setPSituation(finalText);
  if (field === "pNotes") return setPNotes((prev) => (prev ? prev + "\n" : "") + finalText); // append (ajout = concatène)

  // ---- événement (champs texte)
  if (field === "eType") return setEType(finalText);
  if (field === "eTitle") return setETitle(finalText);
  if (field === "ePlace") return setEPlace(finalText);
  if (field === "ePeople") return setEPeople(finalText);
  if (field === "eNotes") return setENotes((prev) => (prev ? prev + "\n" : "") + finalText);
}

function startDictationFor(field: string) {
  setDictationError(null);
  stopSpeak();
  const SpeechRecognition =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (!SpeechRecognition) {
    setDictationError("Dictée vocale non disponible sur ce navigateur.");
    return;
  }

  lastFinalChunkRef.current = "";
  dictationSessionRef.current = "";

  try {
    recognitionRef.current?.stop?.();
  } catch {}

  setActiveField(field);

  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => setIsDictating(true);

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res.isFinal) continue;

      const transcript = String(res[0]?.transcript || "").trim();
      if (!transcript) continue;

      if (transcript === lastFinalChunkRef.current) continue;
      lastFinalChunkRef.current = transcript;

      applyDictation(field, transcript);
      dictationSessionRef.current = dictationSessionRef.current
        ? dictationSessionRef.current + " " + transcript
        : transcript;
    }
  };

  recognition.onerror = (e: any) => {
    setDictationError(e?.error ? String(e.error) : "Erreur dictée vocale.");
    setIsDictating(false);
    setActiveField(null);
  };

  recognition.onend = () => {
    setIsDictating(false);
    setActiveField(null);

    if (autoReadAfterDictation && dictationSessionRef.current.trim()) {
      speak(dictationSessionRef.current.trim());
    }
  };

  recognitionRef.current = recognition;

  try {
    recognition.start();
  } catch {
    setDictationError("Impossible de démarrer la dictée (autorisation micro ?).");
    setIsDictating(false);
    setActiveField(null);
  }
}

function stopDictation() {
  try {
    recognitionRef.current?.stop?.();
  } catch {}

  setIsDictating(false);
  setActiveField(null);

  if (autoReadAfterDictation && dictationSessionRef.current.trim()) {
    speak(dictationSessionRef.current.trim());
  }
}


  // -------------------------
  // Chargement (useEffect = hook React exécuté au chargement)
  // -------------------------
  useEffect(() => {
    let cancelled = false;
    const safe = (fn: () => void) => {
      if (!cancelled) fn();
    };

    const run = async () => {
      try {
        safe(() => setLoading(true));

        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          router.push("/");
          return;
        }

        const { data: timelines, error: tErr } = await supabase
          .from("timelines")
          .select("id,title")
          .order("created_at", { ascending: true })
          .limit(1);

        if (tErr) {
          alert(tErr.message);
          return;
        }

        const t0 = (timelines?.[0] as Timeline) ?? null;
        safe(() => setTimeline(t0));

        if (!t0?.id) {
          alert("Timeline introuvable.");
          return;
        }

        await Promise.all([refreshPeriods(t0.id), refreshEvents(t0.id)]);
      } catch (e: any) {
        console.error("timeline init error:", e);
        alert(e?.message || "Erreur au chargement de la frise.");
      } finally {
        safe(() => setLoading(false));
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // -------------------------
  // Refresh (refresh = recharger depuis Supabase)
  // -------------------------
  async function refreshPeriods(timelineId: string) {
    const { data, error } = await supabase
      .from("periods")
      .select("id,start_date,end_date,place,people,situation,notes")
      .eq("timeline_id", timelineId)
      .order("start_date", { ascending: true });

    if (error) return alert(error.message);
    setPeriods((data ?? []) as Period[]);
  }

  async function refreshEvents(timelineId: string) {
    const { data, error } = await supabase
      .from("events")
      .select("id,event_date,event_type,title,place,people,notes")
      .eq("timeline_id", timelineId)
      .order("event_date", { ascending: true });

    if (error) return alert(error.message);
    setEvents((data ?? []) as LifeEvent[]);
  }

  // -------------------------
  // Helpers (helper = petite fonction utilitaire)
  // -------------------------
  function resetPeriodForm() {
    setEditingPeriodId(null);
    setPStartDate("");
    setPEndDate("");
    setPPlace("");
    setPPeople("");
    setPSituation("");
    setPNotes("");
  }

  function resetEventForm() {
    setEditingEventId(null);
    setEDate("");
    setEType("");
    setETitle("");
    setEPlace("");
    setEPeople("");
    setENotes("");
  }

  function openPeriodEditor(p: Period) {
    setEditingPeriodId(p.id);
    setPStartDate(p.start_date ?? "");
    setPEndDate(p.end_date ?? "");
    setPPlace(p.place ?? "");
    setPPeople(p.people ?? "");
    setPSituation(p.situation ?? "");
    setPNotes(p.notes ?? "");

    setTimeout(() => {
      document.getElementById("period-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openEventEditor(e: LifeEvent) {
    setEditingEventId(e.id);
    setEDate(e.event_date ?? "");
    setEType(e.event_type ?? "");
    setETitle(e.title ?? "");
    setEPlace(e.place ?? "");
    setEPeople(e.people ?? "");
    setENotes(e.notes ?? "");

    setTimeout(() => {
      document.getElementById("event-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  // -------------------------
  // CRUD périodes (CRUD = créer/modifier/supprimer)
  // -------------------------
  async function savePeriod() {
    const timelineId = timeline?.id;
    if (!timelineId) return alert("Timeline introuvable.");

    if (!pStartDate && !pEndDate) return alert("Renseigne au moins une date (début ou fin).");

    if (editingPeriodId) {
      // update (mise à jour = modification) : ne pas renvoyer timeline_id
      const { error } = await supabase
        .from("periods")
        .update({
          start_date: pStartDate || null,
          end_date: pEndDate || null,
          place: pPlace.trim() || null,
          people: pPeople.trim() || null,
          situation: pSituation.trim() || null,
          notes: pNotes.trim() || null,
        })
        .eq("id", editingPeriodId)
        .eq("timeline_id", timelineId);

      if (error) return alert(error.message);
    } else {
      // insert (insertion = création) : timeline_id requis
      const { error } = await supabase.from("periods").insert({
        timeline_id: timelineId,
        start_date: pStartDate || null,
        end_date: pEndDate || null,
        place: pPlace.trim() || null,
        people: pPeople.trim() || null,
        situation: pSituation.trim() || null,
        notes: pNotes.trim() || null,
      });

      if (error) return alert(error.message);
    }

    resetPeriodForm();
    await refreshPeriods(timelineId);
  }

  async function deletePeriod(id: string) {
    const timelineId = timeline?.id;
    if (!timelineId) return alert("Timeline introuvable.");

    const ok = confirm("Supprimer cette période ?");
    if (!ok) return;

    const { error } = await supabase.from("periods").delete().eq("id", id).eq("timeline_id", timelineId);
    if (error) return alert(error.message);

    if (editingPeriodId === id) resetPeriodForm();
    await refreshPeriods(timelineId);
  }

  // -------------------------
  // CRUD événements
  // -------------------------
  async function saveEvent() {
    const timelineId = timeline?.id;
    if (!timelineId) return alert("Timeline introuvable.");

    if (!eDate) return alert("Renseigne la date de l’événement.");

    if (editingEventId) {
      const { error } = await supabase
        .from("events")
        .update({
          event_date: eDate || null,
          event_type: eType.trim() || null,
          title: eTitle.trim() || null,
          place: ePlace.trim() || null,
          people: ePeople.trim() || null,
          notes: eNotes.trim() || null,
        })
        .eq("id", editingEventId)
        .eq("timeline_id", timelineId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("events").insert({
        timeline_id: timelineId,
        event_date: eDate || null,
        event_type: eType.trim() || null,
        title: eTitle.trim() || null,
        place: ePlace.trim() || null,
        people: ePeople.trim() || null,
        notes: eNotes.trim() || null,
      });

      if (error) return alert(error.message);
    }

    resetEventForm();
    await refreshEvents(timelineId);
  }

  async function deleteEvent(id: string) {
    const timelineId = timeline?.id;
    if (!timelineId) return alert("Timeline introuvable.");

    const ok = confirm("Supprimer cet événement ?");
    if (!ok) return;

    const { error } = await supabase.from("events").delete().eq("id", id).eq("timeline_id", timelineId);
    if (error) return alert(error.message);

    if (editingEventId === id) resetEventForm();
    await refreshEvents(timelineId);
  }

function speak(text: string) {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  window.speechSynthesis.speak(u);
}

function stopSpeak() {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

  // -------------------------
  // Render
  // -------------------------
  if (loading) return <main style={{ padding: 16 }}>Chargement…</main>;

  const badge = (kind: "period" | "event") => ({
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #eee",
    background: kind === "period" ? "#e8f2ff" : "#fff3e6",
  });

  return (
    <div style={{ padding: 16 }}>
      <AppNav />

      <h1 style={{ marginTop: 0 }}>Frise chronologique</h1>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={autoReadAfterDictation}
          onChange={(e) => setAutoReadAfterDictation(e.target.checked)}
        />
        🔊 Relecture automatique après dictée
      </label>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={() => router.push("/timeline")} style={{ cursor: "pointer" }}>
          Tout
        </button>
        <button onClick={() => router.push("/timeline?tab=periods")} style={{ cursor: "pointer" }}>
          Périodes
        </button>
        <button onClick={() => router.push("/timeline?tab=events")} style={{ cursor: "pointer" }}>
          Événements
        </button>
      </div>

      {/* Liste chrono (une colonne = affichage vertical) */}
      <section style={{ marginTop: 18 }}>
        <h2 style={{ marginTop: 0 }}>Chronologie</h2>

        {chrono.length === 0 ? (
          <p>Aucun élément.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            <div style={{ position: "relative", marginTop: 12 }}>
  <div style={railStyle} />

  <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, margin: 0 }}>
    {chrono.map((item) => {
      if (item.kind === "period") {
        const p = item.data;
        return (
          <li key={`p-${p.id}`} style={itemRowStyle}>
            <div style={dotStyle("period")} />

            <div style={cardStyle("period")}>
              <div style={badgeStyle("period")}>PÉRIODE</div>

              <div style={{ marginTop: 8, fontWeight: 950, fontSize: 16 }}>
                {p.start_date ?? "?"} → {p.end_date ?? "?"}
              </div>

              {(p.place || p.people || p.situation) ? (
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                  {p.place ? (
                   <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900 }}>
                     📍 {p.place}
                  </div>
                  ) : null}
                  {p.people ? <span>{p.place ? " • " : ""}👥 {p.people}</span> : null}
                  {p.situation ? <span>{" • "}💼 {p.situation}</span> : null}
                </div>
              ) : null}

              {p.notes ? (
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.45, opacity: 0.95 }}>
                  {p.notes}
                </div>
              ) : null}

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => openPeriodEditor(p)} style={{ cursor: "pointer" }}>
                  ✏️ Modifier
                </button>

                <button
                  onClick={() => router.push(`/memories?periodId=${p.id}&date=${encodeURIComponent(p.start_date || "")}`)}
                  style={{ cursor: "pointer" }}
                >
                  ➕ Souvenir
                </button>

                <button onClick={() => deletePeriod(p.id)} style={{ cursor: "pointer" }}>
                  🗑 Supprimer
                </button>
              </div>
            </div>
          </li>
        );
      }

      const e = item.data;
      return (
        <li key={`e-${e.id}`} style={itemRowStyle}>
          <div style={dotStyle("event")} />

          <div style={cardStyle("event")}>
            <div style={badgeStyle("event")}>ÉVÉNEMENT</div>

            <div style={{ marginTop: 8, fontWeight: 950, fontSize: 16 }}>
              {e.event_date ?? "?"} — {e.event_type ?? "événement"}
            </div>

            {(e.title || e.place || e.people) ? (
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                {e.title ? ( <div style={{ marginTop: 6, fontSize: 15, fontWeight: 900 }}>{e.title}
                </div>
                ) : null}
                {(e.place || e.people) ? (
                <div style={{ marginTop: 4, fontSize: 13, opacity: 0.9 }}>
                {e.place ? <span>📍 {e.place}</span> : null}
                {e.people ? <span>{e.place ? " • " : ""}👥 {e.people}</span> : null}
                 </div>
                ) : null}
              </div>
            ) : null}

            {e.notes ? (
              <div style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.45, opacity: 0.95 }}>
                {e.notes}
              </div>
            ) : null}

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => openEventEditor(e)} style={{ cursor: "pointer" }}>
                ✏️ Modifier
              </button>

              <button
                onClick={() =>
                  router.push(`/memories?eventId=${e.id}&date=${encodeURIComponent(e.event_date || "")}`)
                }
                style={{ cursor: "pointer" }}
              >
                ➕ Souvenir
              </button>

              <button onClick={() => deleteEvent(e.id)} style={{ cursor: "pointer" }}>
                🗑 Supprimer
              </button>
            </div>
          </div>
        </li>
      );
    })}
  </ul>
</div>
          </ul>
        )}
      </section>

      {/* Form période (dates l’une au-dessus de l’autre) */}
      <section id="period-form" style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>{editingPeriodId ? "Modifier une période" : "Ajouter une période"}</h2>
{dictationError ? (
  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>⚠️ {dictationError}</div>
) : null}
        <div style={{ display: "grid", gap: 10 }}>
          <div>
          <label>Début</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              type="date"
              value={pStartDate}
              onChange={(e) => setPStartDate(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
            {isDictating && activeField === "pStartDate" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
            ) : (
              <button onClick={() => startDictationFor("pStartDate")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
            )}
          </div>
        </div>
                  <div>
          <label>Fin</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              type="date"
              value={pEndDate}
              onChange={(e) => setPEndDate(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
            {isDictating && activeField === "pEndDate" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
            ) : (
              <button onClick={() => startDictationFor("pEndDate")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
            )}
          </div>
        </div>

          <div>
            <label>Lieu</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
                placeholder="Ex: Lyon"
                value={pPlace}
                onChange={(e) => setPPlace(e.target.value)}
                style={{ flex: 1, padding: 10, minWidth: 0 }}
              />
              {isDictating && activeField === "pPlace" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("pPlace")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
            </div>
          </div>
          <div>
          <label>Personnes</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              placeholder="Ex: Paulette, Jean"
              value={pPeople}
              onChange={(e) => setPPeople(e.target.value)}
              style={{ flex: 1, padding: 10, minWidth: 0 }}
            />
            {isDictating && activeField === "pPeople" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
            ) : (
              <button onClick={() => startDictationFor("pPeople")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
            )}
          </div>
        </div>
          <div>
          <label>Situation</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              placeholder="Ex: je travaillais comme..."
              value={pSituation}
              onChange={(e) => setPSituation(e.target.value)}
              style={{ flex: 1, padding: 10, minWidth: 0 }}
            />
            {isDictating && activeField === "pSituation" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
            ) : (
              <button onClick={() => startDictationFor("pSituation")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
            )}
          </div>
        </div>
          <div>
          <label>Notes</label>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
            <textarea
              placeholder="Détails…"
              value={pNotes}
              onChange={(e) => setPNotes(e.target.value)}
              style={{ flex: 1, padding: 10, minHeight: 90, minWidth: 0 }}
            />
            {isDictating && activeField === "pNotes" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer", height: 42 }}>⏸ Transcrire</button>
            ) : (
              <button onClick={() => startDictationFor("pNotes")} style={{ cursor: "pointer", height: 42 }}>🎙️ Dicter</button>
            )}
          </div>
        </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={savePeriod} style={{ cursor: "pointer", padding: "10px 14px" }}>
            {editingPeriodId ? "Enregistrer" : "Ajouter"}
          </button>
          {(editingPeriodId || pStartDate || pEndDate || pPlace || pPeople || pSituation || pNotes) ? (
            <button onClick={resetPeriodForm} style={{ cursor: "pointer", padding: "10px 14px" }}>
              Annuler
            </button>
          ) : null}
        </div>
      </section>

      {/* Form événement (date puis type l’un au-dessus de l’autre) */}
      <section id="event-form" style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>{editingEventId ? "Modifier un événement" : "Ajouter un événement"}</h2>
        {dictationError ? (
        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>⚠️ {dictationError}</div>
        ) : null}
        <div style={{ display: "grid", gap: 10 }}>
          <div>
          <label>Date</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              type="date"
              value={eDate}
              onChange={(e) => setEDate(e.target.value)}
              style={{ width: "100%", padding: 10 }}
            />
            {isDictating && activeField === "eDate" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
            ) : (
              <button onClick={() => startDictationFor("eDate")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
            )}
          </div>
        </div>
          <div>
            <label>Type</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
                placeholder="Ex: Mariage, Décès, Déménagement…"
                value={eType}
                onChange={(e) => setEType(e.target.value)}
                style={{ width: "100%", padding: 10 }}
              />
              {isDictating && activeField === "eType" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("eType")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
            </div>
          </div>

          <div>
            <label>Titre (optionnel)</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
                placeholder="Ex: Mariage civil"
                value={eTitle}
                onChange={(e) => setETitle(e.target.value)}
                style={{ flex: 1, padding: 10, minWidth: 0 }}
              />
              {isDictating && activeField === "eTitle" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("eTitle")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
            </div>
          </div>
          <div>
            <label>Lieu</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
                placeholder="Ex: Dakar"
                value={ePlace}
                onChange={(e) => setEPlace(e.target.value)}
                style={{ flex: 1, padding: 10, minWidth: 0 }}
              />
              {isDictating && activeField === "ePlace" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("ePlace")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
            </div>
          </div>
          <div>
            <label>Personnes</label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
                placeholder="Ex: Paulette"
                value={ePeople}
                onChange={(e) => setEPeople(e.target.value)}
                style={{ flex: 1, padding: 10, minWidth: 0 }}
              />
              {isDictating && activeField === "ePeople" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸ Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("ePeople")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
            </div>
          </div>
          <div>
            <label>Notes</label>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
              <textarea
                placeholder="Détails…"
                value={eNotes}
                onChange={(e) => setENotes(e.target.value)}
                style={{ flex: 1, padding: 10, minHeight: 90, minWidth: 0 }}
              />
              {isDictating && activeField === "eNotes" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer", height: 42 }}>⏸ Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("eNotes")} style={{ cursor: "pointer", height: 42 }}>🎙️ Dicter</button>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={saveEvent} style={{ cursor: "pointer", padding: "10px 14px" }}>
            {editingEventId ? "Enregistrer" : "Ajouter"}
          </button>
          {(editingEventId || eDate || eType || eTitle || ePlace || ePeople || eNotes) ? (
            <button onClick={resetEventForm} style={{ cursor: "pointer", padding: "10px 14px" }}>
              Annuler
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}