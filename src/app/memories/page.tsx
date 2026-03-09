"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { useSearchParams } from "next/navigation";

type Timeline = { id: string; title: string };

type Period = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  place: string | null;
  people: string | null;
};

type LifeEvent = {
  id: string;
  event_date: string | null;
  event_type: string | null;
  title: string | null;
  place: string | null;
  people: string | null;
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

function MemoriesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // state (état = variable React qui fait rerender quand elle change)
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  // formulaire (formulaire = champs contrôlés)
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [mPeriodId, setMPeriodId] = useState<string | null>(null);
  const [mEventId, setMEventId] = useState<string | null>(null);
  const [mTitle, setMTitle] = useState("");
  const [mContent, setMContent] = useState("");
  const [mOccurredOn, setMOccurredOn] = useState("");
  const [mDateErr, setMDateErr] = useState<string | null>(null);

  // dictée (speech-to-text = transcription vocale)
  const recognitionRef = useRef<any>(null);
  const lastFinalChunkRef = useRef<string>("");
  const dictationSessionRef = useRef<string>("");

  const [isDictating, setIsDictating] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [autoReadAfterDictation, setAutoReadAfterDictation] = useState(true);

  // lookup (index en mémoire = Map pour retrouver vite)
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

  // -------------------------
  // Chargement (useEffect = hook exécuté au montage)
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

        await Promise.all([refreshPeriods(t0.id), refreshEvents(t0.id), refreshMemories(t0.id)]);
      } catch (e: any) {
        console.error("memories init error:", e);
        alert(e?.message || "Erreur au chargement de la page Souvenirs.");
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
  // Requêtes (refresh = recharger depuis Supabase)
  // -------------------------
  async function refreshPeriods(timelineId: string) {
    const { data, error } = await supabase
      .from("periods")
      .select("id,start_date,end_date,place,people")
      .eq("timeline_id", timelineId);

    if (error) return alert(error.message);
    setPeriods((data ?? []) as Period[]);
  }

  async function refreshEvents(timelineId: string) {
    const { data, error } = await supabase
      .from("events")
      .select("id,event_date,event_type,title,place,people")
      .eq("timeline_id", timelineId);

    if (error) return alert(error.message);
    setEvents((data ?? []) as LifeEvent[]);
  }

  async function refreshMemories(timelineId: string) {
    const { data, error } = await supabase
      .from("memories")
      .select("id,timeline_id,period_id,event_id,title,content,occurred_on,created_at,updated_at")
      .eq("timeline_id", timelineId)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setMemories((data ?? []) as Memory[]);
  }

  // -------------------------
  // Form helpers (helpers = petites fonctions utilitaires)
  // -------------------------
  function resetMemoryForm() {
    setEditingMemoryId(null);
    setMPeriodId(null);
    setMEventId(null);
    setMTitle("");
    setMContent("");
    setMOccurredOn("");
    setMDateErr(null);
    setDictationError(null);
  }

  function openMemoryEditor(mem: Memory) {
    setEditingMemoryId(mem.id);
    setMPeriodId(mem.period_id);
    setMEventId(mem.event_id);
    setMTitle(mem.title ?? "");
    setMContent(mem.content ?? "");
    setMOccurredOn(mem.occurred_on ?? "");

    setTimeout(() => {
      document.getElementById("memory-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

useEffect(() => {
  const periodId = searchParams.get("periodId");
  const eventId = searchParams.get("eventId");
  const date = searchParams.get("date");
  if (date) setMOccurredOn(date);
  if (!periodId && !eventId) return;

  // On part en ajout (pas en édition)
  setEditingMemoryId(null);

  if (eventId) {
    setMEventId(eventId);
    setMPeriodId(null);
  } else if (periodId) {
    setMPeriodId(periodId);
    setMEventId(null);
  }

  // Scroll vers le formulaire
  setTimeout(() => {
    document.getElementById("memory-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}, [searchParams]);

  
  // -------------------------
  // CRUD (CRUD = créer/modifier/supprimer)
  // -------------------------
  async function saveMemory() {
    const timelineId = timeline?.id;
    if (!timelineId) return alert("Timeline introuvable.");

    if (!mContent.trim()) return alert("Le contenu du souvenir est vide.");

    const cleanTitle = mTitle.trim() ? mTitle.trim() : null;
    const cleanContent = mContent.trim();
    const cleanOccurredOn = mOccurredOn ? mOccurredOn : null;

    // règle simple: si on choisit un event, on vide period (cohérence = pas deux liens à la fois)
    const cleanPeriodId = mEventId ? null : mPeriodId;
    const cleanEventId = mEventId ? mEventId : null;

    if (editingMemoryId) {
      const { error } = await supabase
        .from("memories")
        .update({
          period_id: cleanPeriodId,
          event_id: cleanEventId,
          title: cleanTitle,
          content: cleanContent,
          occurred_on: cleanOccurredOn,
        })
        .eq("id", editingMemoryId)
        .eq("timeline_id", timelineId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("memories").insert({
        timeline_id: timelineId,
        period_id: cleanPeriodId,
        event_id: cleanEventId,
        title: cleanTitle,
        content: cleanContent,
        occurred_on: cleanOccurredOn,
      });

      if (error) return alert(error.message);
    }

    resetMemoryForm();
    await refreshMemories(timelineId);
  }

  async function deleteMemory(id: string) {
    const timelineId = timeline?.id;
    if (!timelineId) return alert("Timeline introuvable.");

    const ok = confirm("Supprimer ce souvenir ?");
    if (!ok) return;

    const { error } = await supabase.from("memories").delete().eq("id", id).eq("timeline_id", timelineId);
    if (error) return alert(error.message);

    if (editingMemoryId === id) resetMemoryForm();
    await refreshMemories(timelineId);
  }

  // -------------------------
  // Dictée + lecture (text-to-speech = lecture vocale)
  // -------------------------
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

  function parseDateToISO(raw: string): string | null {
    const s0 = (raw || "").toLowerCase().trim();

    const iso = s0.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const y = Number(iso[1]),
        m = Number(iso[2]),
        d = Number(iso[3]);
      if (y >= 1000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }

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

    const s = s0.replace(/^le\s+/, "").replace(/\s+/g, " ").replace(/er\b/, "");

    const months: Record<string, number> = {
      janvier: 1,
      janv: 1,
      fevrier: 2,
      février: 2,
      fev: 2,
      fév: 2,
      mars: 3,
      avril: 4,
      avr: 4,
      mai: 5,
      juin: 6,
      juillet: 7,
      juil: 7,
      aout: 8,
      août: 8,
      septembre: 9,
      sept: 9,
      octobre: 10,
      oct: 10,
      novembre: 11,
      nov: 11,
      decembre: 12,
      décembre: 12,
      dec: 12,
      déc: 12,
    };

    const parts = s.split(" ");
    if (parts.length >= 3) {
      const d = Number(parts[0]);
      const mName = parts[1];
      const y = Number(parts[2]);
      const m = months[mName];
      if (y >= 1000 && m && d >= 1 && d <= 31) {
        return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }

    return null;
  }

  function applyDateDictation(transcript: string, setISO: (v: string) => void, setErr?: (v: string | null) => void) {
    const iso = parseDateToISO(transcript);
    if (!iso) {
      setErr?.("Date non reconnue. Exemples: 23/05/2001, 2001-09-11, 23 mai 2001.");
      return;
    }
    setErr?.(null);
    setISO(iso);
  }

  function applyDictation(field: string, finalText: string) {
    if (field === "mTitle") return setMTitle(finalText);
    if (field === "mContent") return setMContent((prev) => (prev ? prev + "\n" : "") + finalText);
    if (field === "mOccurredOn") return applyDateDictation(finalText, setMOccurredOn, setMDateErr);
  }

  function startDictationFor(field: string) {
    setDictationError(null);

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setDictationError("Dictée vocale non disponible sur ce navigateur.");
      return;
    }

    stopSpeak();
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

    recognition.onstart = () => {
      setIsDictating(true);
    };

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
  // Render (JSX = syntaxe HTML dans du JavaScript)
  // -------------------------
  if (loading) return <main style={{ padding: 16 }}>Chargement…</main>;

  return (
    <div style={{ padding: 16 }}>
      <AppNav />

      <h1 style={{ marginTop: 0 }}>Souvenirs</h1>

      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={autoReadAfterDictation}
          onChange={(e) => setAutoReadAfterDictation(e.target.checked)}
        />
        🔊 Lecture automatique après dictée
      </label>

      {dictationError ? <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>⚠️ {dictationError}</div> : null}

{/* Formulaire */}
      <section
        id="memory-form"
        style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 12 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{editingMemoryId ? "Modifier un souvenir" : "Ajouter un souvenir"}</h2>

          <div
            style={{
              fontSize: 12,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid #eee",
              background: "#fafafa",
              opacity: 0.9,
            }}
          >
            Rattaché à :{" "}
            <b>
              {mEventId ? `événement (${mEventId.slice(0, 6)}…)` : mPeriodId ? `période (${mPeriodId.slice(0, 6)}…)` : "non rattaché"}
            </b>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 14, fontWeight: 700 }}>Date (optionnel)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              style={{ flex: 1, padding: 12, minWidth: 0 }}
              type="date"
              value={mOccurredOn}
              onChange={(e) => setMOccurredOn(e.target.value)}
            />
            {isDictating && activeField === "mOccurredOn" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>
                ⏸ Transcrire
              </button>
            ) : (
              <button onClick={() => startDictationFor("mOccurredOn")} style={{ cursor: "pointer" }}>
                🎙️ Dicter
              </button>
            )}
          </div>
          {mDateErr ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>⚠️ {mDateErr}</div> : null}
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Titre (optionnel)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              placeholder="Ex: Le voyage au Sénégal"
              value={mTitle}
              onChange={(e) => setMTitle(e.target.value)}
              style={{ flex: 1, padding: 10, minWidth: 0 }}
            />
            {isDictating && activeField === "mTitle" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>
                ⏸ Transcrire
              </button>
            ) : (
              <button onClick={() => startDictationFor("mTitle")} style={{ cursor: "pointer" }}>
                🎙️ Dicter
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Souvenir</label>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
            <textarea
              style={{ width: "100%", padding: 10, minHeight: 140, flex: 1 }}
              value={mContent}
              onChange={(e) => setMContent(e.target.value)}
              placeholder="Dicte ou écris ici…"
            />
            {isDictating && activeField === "mContent" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer", height: 42 }}>
                ⏸ Transcrire
              </button>
            ) : (
              <button onClick={() => startDictationFor("mContent")} style={{ cursor: "pointer", height: 42 }}>
                🎙️ Dicter
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={saveMemory} style={{ padding: "10px 14px", cursor: "pointer" }}>
            {editingMemoryId ? "Enregistrer" : "Ajouter"}
          </button>

          {(editingMemoryId || mEventId || mPeriodId || mTitle || mContent || mOccurredOn) ? (
            <button onClick={resetMemoryForm} style={{ padding: "10px 14px", cursor: "pointer" }}>
              Annuler
            </button>
          ) : null}

          <button onClick={stopSpeak} style={{ cursor: "pointer" }}>
            ⏹ Stop lecture
          </button>

          <button onClick={() => speak("Test de lecture Meemorize")} style={{ cursor: "pointer" }}>
            🔊 Test lecture
          </button>
        </div>
      </section>

      {/* Liste */}
      <section style={{ marginTop: 18 }}>
        <h2>Souvenirs</h2>

        {memories.length === 0 ? (
          <p>Aucun souvenir pour l’instant.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {memories.map((mem) => (
              <li key={mem.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 800 }}>
                  {mem.title ? mem.title : "Souvenir"}
                  {mem.occurred_on ? <span style={{ fontWeight: 400 }}> — {mem.occurred_on}</span> : null}
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  {mem.event_id
                    ? (() => {
                        const e = eventById.get(mem.event_id);
                        if (!e) return "Événement introuvable (référence).";
                        return `Événement : ${e.event_date ?? "?"} — ${e.event_type ?? "événement"} — ${e.title ?? "—"}${
                          e.place ? " — " + e.place : ""
                        }`;
                      })()
                    : mem.period_id
                    ? (() => {
                        const p = periodById.get(mem.period_id);
                        if (!p) return "Période introuvable (référence).";
                        return `Période : ${p.start_date ?? "?"} → ${p.end_date ?? "?"}${p.place ? " — " + p.place : ""}${
                          p.people ? " — " + p.people : ""
                        }`;
                      })()
                    : "Non rattaché"}
                </div>

                <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{mem.content}</div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => openMemoryEditor(mem)} style={{ cursor: "pointer", padding: "6px 10px" }}>
                    ✏️ Modifier
                  </button>
                  <button onClick={() => deleteMemory(mem.id)} style={{ cursor: "pointer" }}>
                    🗑 Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      
    </div>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>Chargement…</main>}>
      <MemoriesPageContent />
    </Suspense>
  );
}