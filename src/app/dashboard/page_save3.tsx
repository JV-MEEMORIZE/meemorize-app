"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

type Memory = {
  id: string;
  timeline_id: string;
  period_id: string | null;
  event_id: string | null;
  title: string | null;
  content: string;
  occurred_on: string | null;
  created_at: string;
  updated_at: string;
};

type ChronoItem =
  | { kind: "period"; sortDate: string; data: Period }
  | { kind: "event"; sortDate: string; data: LifeEvent };

export default function Dashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  // Form “souvenir”
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [mPeriodId, setMPeriodId] = useState<string | null>(null);
  const [mEventId, setMEventId] = useState<string | null>(null);
  const [mTitle, setMTitle] = useState("");
  const [mContent, setMContent] = useState("");
  const [mOccurredOn, setMOccurredOn] = useState("");

  // ---- Périodes : mode édition + formulaire ----
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [pStartDate, setPStartDate] = useState("");
  const [pEndDate, setPEndDate] = useState("");
  const [pPlace, setPPlace] = useState("");
  const [pPeople, setPPeople] = useState("");
  const [pSituation, setPSituation] = useState("");
  const [pNotes, setPNotes] = useState("");

  // ---- Événements : mode édition + formulaire ----
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eDate, setEDate] = useState("");
  const [eType, setEType] = useState("");
  const [eTitle, setETitle] = useState("");
  const [ePlace, setEPlace] = useState("");
  const [ePeople, setEPeople] = useState("");
  const [eNotes, setENotes] = useState("");

  const [isDictating, setIsDictating] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);

  const periodById = useMemo(() => {
    const m = new Map<string, Period>();
    periods.forEach((p) => m.set(p.id, p));
    return m;
  }, [periods]);

  const eventById = useMemo(() => {
    const m = new Map<string, LifeEvent>();
    events.forEach((e) => m.set(e.id, e));
    return m;
  }, [events]);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/");
        return;
      }

      const { data: timelines, error: tErr } = await supabase
        .from("timelines")
        .select("id,title")
        .limit(1);

      if (tErr) {
        alert(tErr.message);
        setLoading(false);
        return;
      }

      const t0 = (timelines?.[0] as Timeline) ?? null;
      setTimeline(t0);

      if (t0) {
        await Promise.all([refreshPeriods(t0.id), refreshMemories(t0.id), refreshEvents(t0.id)]);
      }

      setLoading(false);
    })();
  }, [router]);

  async function refreshPeriods(timelineId: string) {
    const { data, error } = await supabase
      .from("periods")
      .select("id,start_date,end_date,place,people,situation,notes")
      .eq("timeline_id", timelineId);

    if (error) {
      alert(error.message);
      return;
    }
    setPeriods((data ?? []) as Period[]);
  }

  async function refreshEvents(timelineId: string) {
    const { data, error } = await supabase
      .from("events")
      .select("id,event_date,event_type,title,place,people,notes")
      .eq("timeline_id", timelineId);

    if (error) {
      alert(error.message);
      return;
    }
    setEvents((data ?? []) as LifeEvent[]);
  }

  async function refreshMemories(timelineId: string) {
    const { data, error } = await supabase
      .from("memories")
      .select("id,timeline_id,period_id,event_id,title,content,occurred_on,created_at,updated_at")
      .eq("timeline_id", timelineId)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }
    setMemories((data ?? []) as Memory[]);
  }

  // ---- Chronologie mixte : périodes + événements triés ----
  const chrono = useMemo<ChronoItem[]>(() => {
    const pItems: ChronoItem[] = periods.map((p) => ({
      kind: "period",
      sortDate: p.start_date ?? "9999-12-31",
      data: p,
    }));

    const eItems: ChronoItem[] = events.map((e) => ({
      kind: "event",
      sortDate: e.event_date ?? "9999-12-31",
      data: e,
    }));

    const merged = [...pItems, ...eItems];

    merged.sort((a, b) => {
      const d = a.sortDate.localeCompare(b.sortDate);
      if (d !== 0) return d;
      // si même date : événement avant période (plus naturel)
      if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
      return 0;
    });

    return merged;
  }, [periods, events]);

  // ---- Helpers : reset forms ----
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
function resetMemoryForm() {
  setEditingMemoryId(null);
  setMPeriodId(null);
  setMEventId(null);
  setMTitle("");
  setMContent("");
  setMOccurredOn("");
}

function createMemoryFromPeriod(p: Period) {
  resetMemoryForm();
  setMPeriodId(p.id);
  setMEventId(null);
  // date volontairement vide (comme tu veux)
  setMOccurredOn("");
  // pré-remplissage léger
  setMTitle("");
  setMContent("");
  document.getElementById("memory-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function createMemoryFromEvent(e: LifeEvent) {
  resetMemoryForm();
  setMEventId(e.id);
  setMPeriodId(null);
  setMOccurredOn(""); // vide
  setMTitle(e.title ?? "");
  setMContent("");
  document.getElementById("memory-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
  // ---- Périodes CRUD ----
  function startEditPeriod(p: Period) {
    setEditingPeriodId(p.id);
    setPStartDate(p.start_date ?? "");
    setPEndDate(p.end_date ?? "");
    setPPlace(p.place ?? "");
    setPPeople(p.people ?? "");
    setPSituation(p.situation ?? "");
    setPNotes(p.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function savePeriod() {
    if (!timeline) return;

    const payload = {
      start_date: pStartDate || null,
      end_date: pEndDate || null,
      place: pPlace || null,
      people: pPeople || null,
      situation: pSituation || null,
      notes: pNotes || null,
    };

    if (editingPeriodId) {
      const { error } = await supabase.from("periods").update(payload).eq("id", editingPeriodId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("periods")
        .insert({ timeline_id: timeline.id, ...payload });
      if (error) return alert(error.message);
    }

    resetPeriodForm();
    await refreshPeriods(timeline.id);
  }

  async function deletePeriod(periodId: string) {
    if (!timeline) return;
    const ok = confirm("Supprimer cette période ?");
    if (!ok) return;

    const { error } = await supabase.from("periods").delete().eq("id", periodId);
    if (error) return alert(error.message);

    if (editingPeriodId === periodId) resetPeriodForm();
    await refreshPeriods(timeline.id);
  }
async function saveMemory() {
  if (!timeline) return;

  if (!mContent.trim()) {
    alert("Le contenu du souvenir est vide.");
    return;
  }

  const payload = {
    timeline_id: timeline.id,
    period_id: mPeriodId,
    event_id: mEventId,
    title: mTitle || null,
    content: mContent,
    occurred_on: mOccurredOn || null,
  };

  if (editingMemoryId) {
    const { error } = await supabase.from("memories").update(payload).eq("id", editingMemoryId);
    if (error) return alert(error.message);
  } else {
    const { error } = await supabase.from("memories").insert(payload);
    if (error) return alert(error.message);
  }

  resetMemoryForm();
  await refreshMemories(timeline.id);
}

async function deleteMemory(id: string) {
  if (!timeline) return;
  const ok = confirm("Supprimer ce souvenir ?");
  if (!ok) return;

  const { error } = await supabase.from("memories").delete().eq("id", id);
  if (error) return alert(error.message);

  if (editingMemoryId === id) resetMemoryForm();
  await refreshMemories(timeline.id);
}

function startEditMemory(m: Memory) {
  setEditingMemoryId(m.id);
  setMPeriodId(m.period_id);
  setMEventId(m.event_id);
  setMTitle(m.title ?? "");
  setMContent(m.content ?? "");
  setMOccurredOn(m.occurred_on ?? "");
  document.getElementById("memory-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
  // ---- Événements CRUD ----
  function startEditEvent(e: LifeEvent) {
    setEditingEventId(e.id);
    setEDate(e.event_date ?? "");
    setEType(e.event_type ?? "");
    setETitle(e.title ?? "");
    setEPlace(e.place ?? "");
    setEPeople(e.people ?? "");
    setENotes(e.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEvent() {
    if (!timeline) return;

    const payload = {
      event_date: eDate || null,
      event_type: eType || null,
      title: eTitle || null,
      place: ePlace || null,
      people: ePeople || null,
      notes: eNotes || null,
    };

    if (editingEventId) {
      const { error } = await supabase.from("events").update(payload).eq("id", editingEventId);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("events")
        .insert({ timeline_id: timeline.id, ...payload });
      if (error) return alert(error.message);
    }

    resetEventForm();
    await refreshEvents(timeline.id);
  }
function createEventFromPeriod(p: any) {
  // On passe en mode "ajout" (pas édition)
  setEditingEventId(null);

  // Date volontairement vide
  setEDate("");

  // Pré-remplissage doux
  setEType(""); // laisse l'utilisateur choisir (ex: mariage, déménagement...)
  setETitle("");
  setEPlace(p.place ?? "");
  setEPeople(p.people ?? "");
  setENotes(`Lié à la période: ${p.start_date ?? "?"} → ${p.end_date ?? "?"}`);

  // Scroll vers le formulaire événements
  const el = document.getElementById("event-form");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}
  async function deleteEvent(eventId: string) {
    if (!timeline) return;
    const ok = confirm("Supprimer cet événement ?");
    if (!ok) return;

    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) return alert(error.message);

    if (editingEventId === eventId) resetEventForm();
    await refreshEvents(timeline.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) return <main style={{ padding: 16 }}>Chargement…</main>;

  const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

  const recognitionRef = (globalThis as any).__meemorize_recognition_ref || { current: null };
  (globalThis as any).__meemorize_recognition_ref = recognitionRef;

  function startDictation() {
  setDictationError(null);

  if (!SpeechRecognition) {
    setDictationError("Dictée vocale non disponible sur ce navigateur.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onresult = (event: any) => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += transcript;
      else interimText += transcript;
    }

    // On ajoute uniquement les résultats "final" au contenu
    if (finalText.trim()) {
      setMContent((prev) => (prev ? prev + "\n" : "") + finalText.trim());
    }
  };

  recognition.onerror = (e: any) => {
    setDictationError(e?.error ? String(e.error) : "Erreur dictée vocale.");
    setIsDictating(false);
  };

  recognition.onend = () => {
    setIsDictating(false);
  };

  recognitionRef.current = recognition;
  recognition.start();
  setIsDictating(true);
}

function stopDictation() {
  try {
    recognitionRef.current?.stop?.();
  } catch {}
  setIsDictating(false);
}
  

  return (
    <main style={{ maxWidth: 980, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1>Meemorize App — Dashboard</h1>
        <button onClick={signOut} style={{ padding: "10px 14px", cursor: "pointer" }}>
          Déconnexion
        </button>
      </div>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2>Ma timeline</h2>
        {timeline ? (
          <>
            <div><b>Titre :</b> {timeline.title}</div>
            <div style={{ opacity: 0.8 }}><b>ID :</b> {timeline.id}</div>
          </>
        ) : (
          <p>Aucune timeline trouvée.</p>
        )}
      </section>

      {/* --- Formulaire Périodes --- */}
      <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2>{editingPeriodId ? "Modifier une période" : "Ajouter une période"}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Début</label>
            <input style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={pStartDate} onChange={(e) => setPStartDate(e.target.value)} type="date" />
          </div>
          <div>
            <label>Fin</label>
            <input style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={pEndDate} onChange={(e) => setPEndDate(e.target.value)} type="date" />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Lieu</label>
          <input style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={pPlace} onChange={(e) => setPPlace(e.target.value)} placeholder="Paris, Dakar..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Personnes (texte libre)</label>
          <input style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={pPeople} onChange={(e) => setPPeople(e.target.value)} placeholder="Paulette, ..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Situation</label>
          <input style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={pSituation} onChange={(e) => setPSituation(e.target.value)} placeholder="Travail, études, contexte..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Notes</label>
          <textarea style={{ width: "100%", padding: 10, marginTop: 6, minHeight: 90 }}
            value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder="Détails utiles..." />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={savePeriod} style={{ padding: "10px 14px", cursor: "pointer" }}>
            {editingPeriodId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingPeriodId ? (
            <button onClick={resetPeriodForm} style={{ padding: "10px 14px", cursor: "pointer" }}>
              Annuler
            </button>
          ) : null}
        </div>
      </section>

      {/* --- Formulaire Événements --- */}
      <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2>{editingEventId ? "Modifier un événement" : "Ajouter un événement"}</h2>
         
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Date</label>
            <input style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={eDate} onChange={(e) => setEDate(e.target.value)} type="date" />
          </div>
          <div>
            <label>Type (ex: mariage, décès...)</label>
            <input style={{ width: "100%", padding: 10, marginTop: 6 }}
              value={eType} onChange={(e) => setEType(e.target.value)} placeholder="mariage" />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Titre</label>
          <input style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="Mariage avec Paulette" />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Lieu</label>
          <input style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={ePlace} onChange={(e) => setEPlace(e.target.value)} placeholder="Paris, Dakar..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Personnes (texte libre)</label>
          <input style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={ePeople} onChange={(e) => setEPeople(e.target.value)} placeholder="Paulette, ..." />
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Notes</label>
          <textarea style={{ width: "100%", padding: 10, marginTop: 6, minHeight: 90 }}
            value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Détails utiles..." />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={saveEvent} style={{ padding: "10px 14px", cursor: "pointer" }}>
            {editingEventId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingEventId ? (
            <button onClick={resetEventForm} style={{ padding: "10px 14px", cursor: "pointer" }}>
              Annuler
            </button>
          ) : null}
        </div>
      </section>

<section
  id="memory-form"
  style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}
>
  <h2>{editingMemoryId ? "Modifier un souvenir" : "Ajouter un souvenir"}</h2>

  <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
    Rattaché à :{" "}
    {mEventId ? `événement (${mEventId.slice(0, 6)}…)` : mPeriodId ? `période (${mPeriodId.slice(0, 6)}…)` : "non rattaché"}
  </div>

  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
    <div>
      <label>Date (optionnel)</label>
      <input
        style={{ width: "100%", padding: 10, marginTop: 6 }}
        type="date"
        value={mOccurredOn}
        onChange={(e) => setMOccurredOn(e.target.value)}
      />
    </div>
    <div>
      <label>Titre (optionnel)</label>
      <input
        style={{ width: "100%", padding: 10, marginTop: 6 }}
        value={mTitle}
        onChange={(e) => setMTitle(e.target.value)}
        placeholder="Ex: Le voyage au Sénégal"
      />
    </div>
  </div>
<div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
  {!isDictating ? (
    <button onClick={startDictation} style={{ cursor: "pointer" }}>
      🎙️ Dicter
    </button>
  ) : (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>
      ⏸️ Stop
    </button>
  )}

  {dictationError ? (
    <span style={{ fontSize: 12, opacity: 0.8 }}>⚠️ {dictationError}</span>
  ) : null}
</div>
  <div style={{ marginTop: 12 }}>
    <label>Souvenir</label>
    <textarea
      style={{ width: "100%", padding: 10, marginTop: 6, minHeight: 120 }}
      value={mContent}
      onChange={(e) => setMContent(e.target.value)}
      placeholder="Dicte ou écris ici…"
    />
  </div>

  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
    <button onClick={saveMemory} style={{ padding: "10px 14px", cursor: "pointer" }}>
      {editingMemoryId ? "Enregistrer" : "Ajouter"}
    </button>
    {(editingMemoryId || mEventId || mPeriodId || mTitle || mContent || mOccurredOn) ? (
      <button onClick={resetMemoryForm} style={{ padding: "10px 14px", cursor: "pointer" }}>
        Annuler
      </button>
    ) : null}
  </div>
</section>

      {/* --- CHRONOLOGIE MIXTE --- */}
      <section style={{ marginTop: 24 }}>
  <h2>Chronologie</h2>

  {chrono.length === 0 ? (
    <p>Rien pour l’instant.</p>
  ) : (
    <div style={{ position: "relative", marginTop: 14, paddingLeft: 40 }}>
      {/* Ligne verticale */}
      <div
        style={{
          position: "absolute",
          left: 15,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: "#ddd",
        }}
      />

      {chrono.map((item) => {
        const isEvent = item.kind === "event";

        // Styles : orange pour événements, bleu pour périodes
        const dotColor = isEvent ? "#f97316" : "#2563eb";
        const bg = isEvent ? "#fff7ed" : "#eff6ff";
        const border = isEvent ? "#fed7aa" : "#bfdbfe";

        return (
          <div key={`${item.kind}-${item.data.id}`} style={{ position: "relative", marginBottom: 16 }}>
            {/* Point */}
            <div
              style={{
                position: "absolute",
                left: -27,
                top: 10,
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: dotColor,
              }}
            />

            {/* Carte */}
            <div
              style={{
                backgroundColor: bg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                padding: 12,
              }}
            >
              {isEvent ? (
                (() => {
                  const e = item.data as any; // TS: ton ChronoItem assure déjà le type
                  return (
                    <>
                      <div style={{ fontWeight: 800 }}>
                        📌 {e.event_date ?? "?"} — {e.event_type ?? "événement"}
                      </div>
                      <div style={{ fontWeight: 700 }}>{e.title ?? "—"}</div>
                      <div>📍 {e.place ?? "—"}</div>
                      <div>👥 {e.people ?? "—"}</div>
                      {e.notes ? <div style={{ marginTop: 6, opacity: 0.85 }}>{e.notes}</div> : null}
  <button onClick={() => deleteEvent(EventId)} style={{ cursor: "pointer" }}>
    🗑 Supprimer
  </button>
<button onClick={() => createMemoryFromEvent(e)} style={{ cursor: "pointer" }}>
  ➕ Souvenir
</button>
                    </>
                  );
                })()
              ) : (
                (() => {
                  const p = item.data as any;
                  return (
                    <>
                      <div style={{ fontWeight: 800 }}>
                        🧱 {p.start_date ?? "?"} → {p.end_date ?? "?"}
                      </div>
                      <div>📍 {p.place ?? "—"}</div>
                      <div>👥 {p.people ?? "—"}</div>
                      <div>🧩 {p.situation ?? "—"}</div>
                      {p.notes ? <div style={{ marginTop: 6, opacity: 0.85 }}>{p.notes}</div> : null}
                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
  <button onClick={() => startEditPeriod(p)} style={{ cursor: "pointer" }}>
    ✏️ Modifier
  </button>
  <button onClick={() => deletePeriod(p.id)} style={{ cursor: "pointer" }}>
    🗑 Supprimer
  </button>
  <button onClick={() => createEventFromPeriod(p)} style={{ cursor: "pointer" }}>
    ➕ Événement
  </button>
  <button onClick={() => createMemoryFromPeriod(p)} style={{ cursor: "pointer" }}>
  ➕ Souvenir
  </button>
  
</div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        );
      })}
    </div>
  )}
</section>
<section style={{ marginTop: 18 }}>
  <h2>Souvenirs</h2>

  {memories.length === 0 ? (
    <p>Aucun souvenir pour l’instant.</p>
  ) : (
    <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
      {memories.map((m) => (
        <li key={m.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 800 }}>
            {m.title ? m.title : "Souvenir"}
            {m.occurred_on ? <span style={{ fontWeight: 400 }}> — {m.occurred_on}</span> : null}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          {m.event_id ? (() => {
          const e = eventById.get(m.event_id);
          if (!e) return "Événement introuvable (référence).";
          return `Événement : ${e.event_date ?? "?"} — ${e.event_type ?? "événement"} — ${e.title ?? "—"}${e.place ? " — " + e.place : ""}`;
          })() : m.period_id ? (() => {
          const p = periodById.get(m.period_id);
          if (!p) return "Période introuvable (référence).";
          return `Période : ${p.start_date ?? "?"} → ${p.end_date ?? "?"}${p.place ? " — " + p.place : ""}${p.people ? " — " + p.people : ""}`;
          })() : "Non rattaché"}
          </div>
          <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{m.content}</div>

          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <button onClick={() => startEditMemory(m)} style={{ cursor: "pointer" }}>
              ✏️ Modifier
            </button>
            <button onClick={() => deleteMemory(m.id)} style={{ cursor: "pointer" }}>
              🗑 Supprimer
            </button>
          </div>
        </li>
      ))}
    </ul>
  )}
</section>
    </main>
  );
}
