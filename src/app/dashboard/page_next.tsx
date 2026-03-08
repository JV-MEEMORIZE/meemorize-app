"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import Link from "next/link";

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

  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefs, setPrefs] = useState<any>(null);
  const [showPrefs, setShowPrefs] = useState(false);

  // champs édition prefs
  const [prefLength, setPrefLength] = useState<400 | 600 | 900>(600);
  const [prefHist, setPrefHist] = useState<"off" | "discret" | "moyen">("off");
  const [prefStyle, setPrefStyle] = useState<"sobre" | "chaleureux" | "romance_leger">("sobre");

  // ---- Événements : mode édition + formulaire ----
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eDate, setEDate] = useState("");
  const [eType, setEType] = useState("");
  const [eTitle, setETitle] = useState("");
  const [ePlace, setEPlace] = useState("");
  const [ePeople, setEPeople] = useState("");
  const [eNotes, setENotes] = useState("");

  
  
  

  const [lastChapter, setLastChapter] = useState<any>(null);

  const [chapterFilter, setChapterFilter] = useState<"all" | "draft" | "validated">("all");

  const [bookPreview, setBookPreview] = useState<string>("");

  

  

  const recognitionRef = useRef<any>(null);
  const lastFinalChunkRef = useRef<string>("");
  const dictationSessionRef = useRef<string>("");

  const [isDictating, setIsDictating] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);

  const [autoReadAfterDictation, setAutoReadAfterDictation] = useState(true);
  const [dictationSessionText, setDictationSessionText] = useState("");

  const [mDateErr, setMDateErr] = useState<string | null>(null);

  const [eDateErr, setEDateErr] = useState<string | null>(null);
  const [pStartDateErr, setPStartDateErr] = useState<string | null>(null);
  const [pEndDateErr, setPEndDateErr] = useState<string | null>(null);

  const [scanCandidates, setScanCandidates] = useState<any[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedCandidateNorms, setSelectedCandidateNorms] = useState<Set<string>>(new Set());

  const [people, setPeople] = useState<any[]>([]);
  const [mentions, setMentions] = useState<any[]>([]);

  const [editingContactPersonId, setEditingContactPersonId] = useState<string | null>(null);

  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cSocialType, setCSocialType] = useState<"facebook"|"instagram"|"x"|"linkedin"|"tiktok"|"other"|"">("");
  const [cSocialHandle, setCSocialHandle] = useState("");
  const [cNotes, setCNotes] = useState("");

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

const memoriesByPeriodId = useMemo(() => {
  const m = new Map<string, Memory[]>();
  for (const mem of memories) {
    if (!mem.period_id) continue;
    const arr = m.get(mem.period_id) ?? [];
    arr.push(mem);
    m.set(mem.period_id, arr);
  }
  return m;
}, [memories]);

const memoriesByEventId = useMemo(() => {
  const m = new Map<string, Memory[]>();
  for (const mem of memories) {
    if (!mem.event_id) continue;
    const arr = m.get(mem.event_id) ?? [];
    arr.push(mem);
    m.set(mem.event_id, arr);
  }
  return m;
}, [memories]);

  const [chapters, setChapters] = useState<any[]>([]);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [chapterTextDraft, setChapterTextDraft] = useState("");
  const [chapterTitleDraft, setChapterTitleDraft] = useState("");

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
      async function refreshLastChapter(timelineId: string) {
        const { data, error } = await supabase
          .from("chapters")
          .select("id, timeline_id, chapter_title, chapter_text, status, created_at")
          .eq("timeline_id", timelineId)
          .eq("status", "validated")
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) return alert(error.message);

        setLastChapter(data?.[0] ?? null);
}
      const t0 = (timelines?.[0] as Timeline) ?? null;
      setTimeline(t0);


      
      const { data: prefRow, error: prefErr } = await supabase
        .from("writing_preferences")
        .select("owner_id,chapter_length_words,historical_enrichment,style")
        .maybeSingle();

      if (prefErr) alert(prefErr.message);

      if (!prefRow) {
        setPrefs(null);
        setShowPrefs(true); // first-run obligatoire
      } else {
        setPrefs(prefRow);
        setPrefLength(prefRow.chapter_length_words);
        setPrefHist(prefRow.historical_enrichment);
        setPrefStyle(prefRow.style);
      }
      setPrefsLoading(false);

      if (t0) {
        await Promise.all([refreshPeriods(t0.id), refreshEvents(t0.id), refreshPeople(t0.id), refreshMentions(t0.id),refreshMemories(t0.id), refreshLastChapter(t0.id), refreshChapters(t0.id), ]);
      }

      setLoading(false);

      if (timeline?.id) await refreshLastChapter(timeline.id);

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

  async function refreshChapters(timelineId: string) {
  const { data, error } = await supabase
    .from("chapters")
    .select("id,period_id,event_id,chapter_title,chapter_text,chapter_summary,status,created_at,updated_at")
    .eq("timeline_id", timelineId)
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }
  setChapters(data ?? []);
  }
  
  async function scanPeople() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return alert("Session expirée.");

  setScanLoading(true);
  try {
    const res = await fetch("/api/scan-people", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    if (!res.ok) return alert(json?.error || "Erreur scan");

    setScanCandidates(json.candidates || []);
    setSelectedCandidateNorms(new Set()); // reset
  } finally {
    setScanLoading(false);
  }
  }

function normNameClient(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim();
}

  async function applyScanSelection() {
    if (!timeline) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return alert("Session expirée.");

    const selected = scanCandidates.filter((c) => selectedCandidateNorms.has(normNameClient(c.display_name)));

    if (selected.length === 0) return alert("Sélection vide.");

    const res = await fetch("/api/apply-people-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timelineId: timeline.id, selectedCandidates: selected }),
    });

    const json = await res.json();
    if (!res.ok) return alert(json?.error || "Erreur création");

    await Promise.all([refreshPeople(timeline.id), refreshMentions(timeline.id)]);
    setScanCandidates([]);
    setSelectedCandidateNorms(new Set());
    alert(`Créé: ${json.created}`);
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

function openContactEditor(p: any) {
  setEditingContactPersonId(p.id);
  setCPhone(p.phone ?? "");
  setCEmail(p.email ?? "");
  setCSocialType(p.social_type ?? "");
  setCSocialHandle(p.social_handle ?? "");
  setCNotes(p.notes ?? "");
}

async function saveContact() {
  if (!timeline) return;
  if (!editingContactPersonId) return;

  const { error } = await supabase
    .from("people")
    .update({
      phone: cPhone.trim() || null,
      email: cEmail.trim() || null,
      social_type: cSocialType || null,
      social_handle: cSocialHandle.trim() || null,
      notes: cNotes.trim() || null,
    })
    .eq("id", editingContactPersonId);

  if (error) return alert(error.message);

  await refreshPeople(timeline.id);
  setEditingContactPersonId(null);
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

async function generateChapter(scopeType: "period" | "event", scopeId: string) {
  if (!prefs) {
    setShowPrefs(true);
    alert("Choisis d’abord tes réglages d’écriture.");
    document.getElementById("chapter-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });return;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return alert("Session expirée. Reconnecte-toi.");

  const res = await fetch("/api/generate-chapter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ scopeType, scopeId }),
  });

  const json = await res.json();
  if (!res.ok) {
    if (json?.error === "MISSING_PREFS") {
      setShowPrefs(true);
      alert("Réglages d’écriture manquants.");
      return;
    }
    alert(json?.error || "Erreur génération chapitre");
    return;
  }

  // après: const json = await res.json();

  if (!res.ok) {
  alert(JSON.stringify(json, null, 2));
  return;
  }

  // ✅ stocke le résultat pour affichage
    setLastChapter({
  chapter: json.chapter,
  ai_json: json.ai_json,
  });

  const timelineId = timeline?.id;
if (!timelineId) return;

// ✅ scroll vers l’aperçu
setTimeout(() => {
  document.getElementById("chapter-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}, 0);

await refreshChapters(timelineId);

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



function applyDictation(field: string, finalText: string) {
  // Champs “longs” -> append
  const appendFields = new Set(["pNotes", "eNotes", "mContent", "chapterTextDraft"]);

  const append = appendFields.has(field);

  const add = (setter: (fn: any) => void) => {
    setter((prev: string) => (append ? ((prev ? prev + "\n" : "") + finalText) : finalText));
  };

  switch (field) {
    // Périodes
    case "pPlace": return add(setPPlace);
    case "pPeople": return add(setPPeople);
    case "pSituation": return add(setPSituation);
    case "pNotes": return add(setPNotes);

    // Evénements
    case "eType": return add(setEType);
    case "eTitle": return add(setETitle);
    case "ePlace": return add(setEPlace);
    case "ePeople": return add(setEPeople);
    case "eNotes": return add(setENotes);

    // Souvenirs
    case "mTitle": return add(setMTitle);
    case "mContent": return add(setMContent);
    case "mOccurredOn":
      return applyDateDictation(finalText, setMOccurredOn, setMDateErr);

    // Chapitres (éditeur)
    case "chapterTitleDraft": return add(setChapterTitleDraft);
    case "chapterTextDraft": return add(setChapterTextDraft);

    case "eDate":
      return applyDateDictation(finalText, setEDate, setEDateErr);

    case "pStartDate":
     return applyDateDictation(finalText, setPStartDate, setPStartDateErr);

    case "pEndDate":
      return applyDateDictation(finalText, setPEndDate, setPEndDateErr);

    case "cPhone":
      return setCPhone(finalText);

    case "cEmail":
      return setCEmail(normalizeEmailFromSpeech(finalText));

    case "cSocialHandle":
      return setCSocialHandle(finalText);

    case "cNotes":
      return setCNotes((prev) => (prev ? prev + "\n" : "") + finalText);

    default:
      return;
  }
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

  // reset session
  stopSpeak();
  lastFinalChunkRef.current = "";
  dictationSessionRef.current = "";
  setDictationSessionText("");

  // stop instance précédente si elle existe
  try {
    recognitionRef.current?.stop?.();
  } catch {}

  setActiveField(field);

  const recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => {
    console.log("[DICTEE] start", field);
    setIsDictating(true);
  };

  recognition.onresult = (event: any) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (!res.isFinal) continue;

      const transcript = String(res[0]?.transcript || "").trim();
      if (!transcript) continue;

      // anti doublon robuste
      if (transcript === lastFinalChunkRef.current) continue;
      lastFinalChunkRef.current = transcript;

      applyDictation(field, transcript);

      dictationSessionRef.current = dictationSessionRef.current
        ? dictationSessionRef.current + " " + transcript
        : transcript;

      setDictationSessionText(dictationSessionRef.current);
    }
  };

  recognition.onerror = (e: any) => {
    console.log("[DICTEE] error", e);
    setDictationError(e?.error ? String(e.error) : "Erreur dictée vocale.");
    setIsDictating(false);
    setActiveField(null);
  };

  recognition.onend = () => {
    console.log("[DICTEE] end");
    setIsDictating(false);
    setActiveField(null);
  if (autoReadAfterDictation && dictationSessionRef.current.trim()) {
    speak(dictationSessionRef.current.trim());
  }
  };

  recognitionRef.current = recognition;

  try {
    recognition.start();
  } catch (err) {
    console.log("[DICTEE] start() failed", err);
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

const filteredChapters = chapters.filter((c) => {
  if (chapterFilter === "all") return true;
  return c.status === chapterFilter;
});

async function exportPdf() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return alert("Session expirée. Reconnecte-toi.");

  const res = await fetch("/api/export-book", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    alert(json?.error || "Erreur export PDF");
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meemorize-export.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

function parseDateToISO(raw: string): string | null {
  const s0 = (raw || "").toLowerCase().trim();

  // 1) déjà ISO: 2001-09-11
  const iso = s0.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]), m = Number(iso[2]), d = Number(iso[3]);
    if (y >= 1000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 2) dd/mm/yyyy ou dd-mm-yyyy
  const dmy = s0.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const d = Number(dmy[1]), m = Number(dmy[2]);
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    if (y >= 1000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 3) "23 mai 2001" / "le 3 janvier 1999"
  const s = s0
    .replace(/^le\s+/, "")
    .replace(/\s+/g, " ")
    .replace(/er\b/, ""); // 1er -> 1

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

async function refreshPeople(timelineId: string) {
  const { data, error } = await supabase
    .from("people")
    .select("id,timeline_id,display_name,role,phone,email,social_type,social_handle,notes,created_at,updated_at")
    .eq("timeline_id", timelineId)
    .order("display_name", { ascending: true });

  if (error) return alert(error.message);
  setPeople(data ?? []);
}

async function refreshMentions(timelineId: string) {
  const { data, error } = await supabase
    .from("person_mentions")
    .select("id,timeline_id,person_id,source_type,source_id,created_at")
    .eq("timeline_id", timelineId);

  if (error) return alert(error.message);
  setMentions(data ?? []);
}

function normalizeEmailFromSpeech(raw: string): string {
  let s = raw.toLowerCase().trim();

  // remplacements vocaux
  s = s
    .replace(/\barobase\b/g, "@")
    .replace(/\barrobe\b/g, "@")
    .replace(/\bat\b/g, "@")
    .replace(/\bpoint\b/g, ".")
    .replace(/\bdot\b/g, ".")
    .replace(/\btiret\b/g, "-")
    .replace(/\btrait d'union\b/g, "-")
    .replace(/\bunderscore\b/g, "_")
    .replace(/\bsouligné\b/g, "_");

  // supprimer espaces
  s = s.replace(/\s+/g, "");




  return s;
}

  return (
    
    <main style={{ maxWidth: 980, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
      <AppNav /> 
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        
        <h1>Meemorize App — Dashboard</h1>
        <button onClick={signOut} style={{ padding: "10px 14px", cursor: "pointer" }}>
          Déconnexion
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="checkbox"
            checked={autoReadAfterDictation}
            onChange={(e) => setAutoReadAfterDictation(e.target.checked)}
          />
          🔊 Lecture automatique après dictée
        </label>
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



{showPrefs ? (
    <section style={{ marginTop: 18, padding: 14, border: "2px solid #111", borderRadius: 10 }}>
      <h2>Réglages d’écriture (obligatoire)</h2>
      <p style={{ marginTop: 6, opacity: 0.85 }}>
        Recommandation : <b>Contexte historique = Off</b> au départ.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 10 }}>
        <div>
          <label>Longueur</label>
          <select style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={prefLength}
            onChange={(e) => setPrefLength(Number(e.target.value) as any)}
          >
            <option value={400}>400 mots</option>
            <option value={600}>600 mots</option>
            <option value={900}>900 mots</option>
          </select>
        </div>

        <div>
          <label>Contexte historique</label>
          <select style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={prefHist}
            onChange={(e) => setPrefHist(e.target.value as any)}
          >
            <option value="off">Off (recommandé)</option>
            <option value="discret">Discret</option>
            <option value="moyen">Moyen</option>
          </select>
        </div>

        <div>
          <label>Style</label>
          <select style={{ width: "100%", padding: 10, marginTop: 6 }}
            value={prefStyle}
            onChange={(e) => setPrefStyle(e.target.value as any)}
          >
            <option value="sobre">Sobre</option>
            <option value="chaleureux">Chaleureux</option>
            <option value="romance_leger">Romancé léger</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
        <button
          onClick={async () => {
            const { data: userData } = await supabase.auth.getUser();
            const uid = userData.user?.id;
            if (!uid) return alert("Utilisateur non connecté.");

            const payload = {
              owner_id: uid,
              chapter_length_words: prefLength,
              historical_enrichment: prefHist,
              style: prefStyle,
            };

            // upsert = create or update
            const { error } = await supabase.from("writing_preferences").upsert(payload);
            if (error) return alert(error.message);

            setPrefs(payload);
            setShowPrefs(false);
          }}
          style={{ padding: "10px 14px", cursor: "pointer" }}
        >
          Enregistrer
        </button>

        <button
          onClick={() => {
            // pas de skip au first-run : on laisse ce bouton seulement si prefs existaient déjà
            alert("Ces réglages sont nécessaires pour générer un chapitre.");
          }}
          style={{ padding: "10px 14px", cursor: "pointer" }}
        >
          Pourquoi ?
        </button>
      </div>
    </section>
  ) : null}

<section
  id="chapter-preview"
  style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}
>
  <h2>Dernier chapitre généré</h2>

  {!lastChapter ? (
    <p>Aucun chapitre généré dans cette session.</p>
  ) : (
    <>
      <div style={{ fontWeight: 800 }}>
        {lastChapter.ai_json?.chapter_title ?? lastChapter.chapter?.chapter_title ?? "Sans titre"}
      </div>

      {lastChapter.ai_json?.chapter_summary ? (
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          <b>Résumé :</b> {lastChapter.ai_json.chapter_summary}
        </div>
      ) : null}

      <div style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
        {lastChapter.ai_json?.chapter_text ?? lastChapter.chapter?.chapter_text ?? ""}
      </div>

      {Array.isArray(lastChapter.ai_json?.open_questions_for_mee) &&
      lastChapter.ai_json.open_questions_for_mee.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <b>Questions pour Mee</b>
          <ul>
            {lastChapter.ai_json.open_questions_for_mee.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    <Link href="/chapters">
    <button style={{ cursor: "pointer", padding: "8px 12px" }}>Voir tous →</button>
    </Link>
    </>
    
  )}
</section>


<section id="book-preview" style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
  <h2>Aperçu livre</h2>
  <button onClick={exportPdf} style={{ cursor: "pointer", marginTop: 10 }}>
  📄 Export PDF (chapitres validés)
</button>
  {!bookPreview ? (
    <p>Aucun aperçu pour l’instant.</p>
  ) : (
    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.5 }}>
      {bookPreview}
    </pre>
  )}
</section>
      {/* --- Formulaire Périodes --- */}
      <section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2>{editingPeriodId ? "Modifier une période" : "Ajouter une période"}</h2>

        <div style={{ display: "flex", gap: 50, alignItems: "center"}}>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 700 }}>Date de début</label>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              style={{ flex: 1, padding: 12, minWidth: 0 }}
              type="date"
              value={pStartDate}
              onChange={(e) => setPStartDate(e.target.value)}
              />

              {isDictating && activeField === "pStartDate" ? (
            <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
            ) : (
            <button onClick={() => startDictationFor("pStartDate")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
            )}
          </div>

          {pStartDateErr ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>⚠️ {pStartDateErr}</div> : null}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 700 }}>Date de fin</label>

             <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
              style={{ flex: 1, padding: 12, minWidth: 0 }}
              type="date"
              value={pEndDate}
              onChange={(e) => setPEndDate(e.target.value)}
                />

              {isDictating && activeField === "pEndDate" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
              ) : (
              <button onClick={() => startDictationFor("pEndDate")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
              </div>

            {pEndDateErr ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>⚠️ {pEndDateErr}</div> : null}
            </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Lieu"
    value={pPlace}
    onChange={(e) => setPPlace(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "pPlace" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("pPlace")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Personnes"
    value={pPeople}
    onChange={(e) => setPPeople(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "pPeople" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("pPeople")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Situation"
    value={pSituation}
    onChange={(e) => setPSituation(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "pSituation" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("pSituation")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Notes"
    value={pNotes}
    onChange={(e) => setPNotes(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "pNotes" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("pNotes")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
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
         
        
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 700 }}>Date</label>

            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
              <input
                style={{ flex: 1, padding: 12, minWidth: 0 }}
                type="date"
                value={eDate}
                onChange={(e) => setEDate(e.target.value)}
              />

              {isDictating && activeField === "eDate" ? (
                <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
              ) : (
                <button onClick={() => startDictationFor("eDate")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
              )}
            </div>

            {eDateErr ? <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>⚠️ {eDateErr}</div> : null}
          </div>
          <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Type</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
            <input
              placeholder="Ex: mariage, déménagement…"
              value={eType}
              onChange={(e) => setEType(e.target.value)}
              style={{ flex: 1, padding: 10, minWidth: 0 }}
            />
            {isDictating && activeField === "eType" ? (
              <button onClick={stopDictation} style={{ cursor: "pointer" }}>
                ⏸  Transcrire
              </button>
            ) : (
              <button onClick={() => startDictationFor("eType")} style={{ cursor: "pointer" }}>
                🎙️ Dicter
              </button>
            )}
          </div>
        

        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Titre"
    value={eTitle}
    onChange={(e) => setETitle(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "eTitle" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("eTitle")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Lieu"
    value={ePlace}
    onChange={(e) => setEPlace(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "ePlace" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("ePlace")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Personnes"
    value={ePeople}
    onChange={(e) => setEPeople(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "ePeople" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("ePeople")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
</div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
  <input
    placeholder="Notes"
    value={eNotes}
    onChange={(e) => setENotes(e.target.value)}
    style={{ flex: 1, padding: 10 }}
  />
  {isDictating && activeField === "eNotes" ? (
    <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
  ) : (
    <button onClick={() => startDictationFor("eNotes")} style={{ cursor: "pointer" }}>🎙️ Dicter</button>
  )}
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
  style={{
    marginTop: 18,
    padding: 14,
    border: "1px solid #ddd",
    borderRadius: 12,
  }}
>
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
    <h2 style={{ margin: 0 }}>
      {editingMemoryId ? "Modifier un souvenir" : "Ajouter un souvenir"}
    </h2>

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
        {mEventId
          ? `événement (${mEventId.slice(0, 6)}…)`
          : mPeriodId
          ? `période (${mPeriodId.slice(0, 6)}…)`
          : "non rattaché"}
      </b>
    </div>
  </div>

  {/* Date + Titre */}
  
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
      <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸  Transcrire</button>
    ) : (
      <button
        onClick={() => startDictationFor("mOccurredOn")}
        style={{ cursor: "pointer" }}
      >
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
        ⏸  Transcrire
      </button>
    ) : (
      <button onClick={() => startDictationFor("mTitle")} style={{ cursor: "pointer" }}>
        🎙️ Dicter
      </button>
    )}
  </div>

  </div>

  {/* Contenu (textarea) */}
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
          ⏸  Transcrire
        </button>
      ) : (
        <button onClick={() => startDictationFor("mContent")} style={{ cursor: "pointer", height: 42 }}>
          🎙️ Dicter
        </button>
      )}
    </div>
    {dictationError ? (
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>⚠️ {dictationError}</div>
    ) : null}
  </div>

  {/* Actions */}
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
    {dictationError ? <div>⚠️ {dictationError}</div> : null}
  </div>
</section>

<section style={{ marginTop: 18, padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
  <h2>Scanner les personnes</h2>

  <button onClick={scanPeople} style={{ cursor: "pointer", padding: "10px 14px" }} disabled={scanLoading}>
    {scanLoading ? "Scan en cours…" : "🔎 Scanner"}
  </button>

  {scanCandidates.length > 0 ? (
    <>
      <div style={{ marginTop: 12, opacity: 0.85 }}>
        Candidats détectés (rien n’est créé sans validation).
      </div>

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10, marginTop: 10 }}>
        {scanCandidates.map((c) => {
          const n = normNameClient(c.display_name);
          const checked = selectedCandidateNorms.has(n);
          return (
            <li key={n} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setSelectedCandidateNorms((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(n);
                      else next.delete(n);
                      return next;
                    });
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{c.display_name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
                    {Array.isArray(c.sources) ? c.sources.slice(0, 3).map((s: any, i: number) => (
                      <div key={i}>
                        • {s.source_type} ({String(s.source_id).slice(0, 6)}…): {s.excerpt}
                      </div>
                    )) : null}
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={applyScanSelection} style={{ cursor: "pointer", padding: "10px 14px" }}>
          ✅ Créer la sélection
        </button>
        <button onClick={() => { setScanCandidates([]); setSelectedCandidateNorms(new Set()); }} style={{ cursor: "pointer", padding: "10px 14px" }}>
          Fermer
        </button>
      </div>
    </>
  ) : null}
</section>



    </main>
  );
}
