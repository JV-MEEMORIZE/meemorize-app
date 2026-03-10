"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
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
        await Promise.all([refreshPeriods(t0.id), refreshEvents(t0.id), refreshPeople(t0.id), refreshMentions(t0.id),refreshMemories(t0.id), refreshChapters(t0.id), ]);
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
   <main   style={{ maxWidth: 980, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
    <div style={{ padding: 16 }}>
          <AppNav />
    
          <h1 style={{ marginTop: 0 }}>Chapitres</h1>
    
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={autoReadAfterDictation}
              onChange={(e) => setAutoReadAfterDictation(e.target.checked)}
            />
            🔊 Lecture automatique après dictée
          </label>
    
          {dictationError ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>⚠️ {dictationError}</div>
          ) : null}
    <section className="glass" style={{ marginTop: 18, padding: 14 }}>
      <h2>Chapitres</h2>
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
      <button onClick={() => setChapterFilter("all")} style={{ cursor: "pointer" }}>
        Tous
      </button>
      <button onClick={() => setChapterFilter("draft")} style={{ cursor: "pointer" }}>
        Draft
      </button>
      <button onClick={() => setChapterFilter("validated")} style={{ cursor: "pointer" }}>
        Validés
      </button>
      </div>
      <button
      onClick={() => {
        const validated = chapters
          .filter((c) => c.status === "validated")
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    
        const text = validated
          .map((c) => `# ${c.chapter_title ?? "Chapitre"}\n\n${c.chapter_text}\n`)
          .join("\n---\n\n");
    
        setBookPreview(text);
        document.getElementById("book-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      style={{ cursor: "pointer", marginTop: 10 }}
      >
      📘 Aperçu livre (chapitres validés)
      </button> 
      {chapters.length === 0 ? (
        <p>Aucun chapitre pour l’instant.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
          {filteredChapters.map((c) => (
            <li key={c.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {c.chapter_title ?? "Sans titre"}{" "}
                    <span style={{ fontWeight: 400, opacity: 0.75 }}>({c.status})</span>
                  </div>
                  {c.chapter_summary ? (
                    <div style={{ marginTop: 6, opacity: 0.85 }}>{c.chapter_summary}</div>
                  ) : null}
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                    {c.event_id ? (() => {
                    const e = eventById.get(c.event_id);
                    if (!e) return "Événement introuvable (référence).";
                    return `Événement : ${e.event_date ?? "?"} — ${e.event_type ?? "événement"} — ${e.title ?? "—"}${e.place ? " — " + e.place : ""}`;
                    })() : c.period_id ? (() => {
                    const p = periodById.get(c.period_id);
                    if (!p) return "Période introuvable (référence).";
                    return `Période : ${p.start_date ?? "?"} → ${p.end_date ?? "?"}${p.place ? " — " + p.place : ""}${p.people ? " — " + p.people : ""}`;
                    })() : "Non rattaché"}
                    {new Date(c.created_at).toLocaleString()}
                  </div>
                </div>
    
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={() => {
                      setEditingChapterId(c.id);
                      setChapterTitleDraft(c.chapter_title ?? "");
                      setChapterTextDraft(c.chapter_text ?? "");
                      document.getElementById("chapter-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    ✏️ Éditer
                  </button>
                </div>
              </div>
    
              {editingChapterId === c.id ? (
                <div id="chapter-editor" style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      value={chapterTitleDraft}
                      onChange={(e) => setChapterTitleDraft(e.target.value)}
                      placeholder="Titre du chapitre"
                      style={{ width: "100%", padding: 10 }}
                    />
                    <textarea
                      value={chapterTextDraft}
                      onChange={(e) => setChapterTextDraft(e.target.value)}
                      style={{ width: "100%", minHeight: 220, padding: 10, whiteSpace: "pre-wrap" }}
                    />
                  </div>
    
                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={async () => {
                        const { error } = await supabase
                          .from("chapters")
                          .update({
                            chapter_title: chapterTitleDraft || null,
                            chapter_text: chapterTextDraft,
                          })
                          .eq("id", c.id);
    
                        if (error) return alert(error.message);
                        setEditingChapterId(null);
                        if (timeline) await refreshChapters(timeline.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      💾 Enregistrer
                    </button>
    
                    <button
                      onClick={async () => {
                        const ok = confirm("Valider ce chapitre ? (il sera marqué comme final)");
                        if (!ok) return;
    
                        const { error } = await supabase
                          .from("chapters")
                          .update({
                            chapter_title: chapterTitleDraft || null,
                            chapter_text: chapterTextDraft,
                            status: "validated",
                          })
                          .eq("id", c.id);
    
                        if (error) return alert(error.message);
                        setEditingChapterId(null);
                        if (timeline) await refreshChapters(timeline.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      ✅ Valider
                    </button>
    
                    <button
                      onClick={() => setEditingChapterId(null)}
                      style={{ cursor: "pointer" }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>

    </div>
  </main>);
}