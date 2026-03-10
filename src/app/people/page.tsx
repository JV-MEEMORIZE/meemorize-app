"use client";

import { useEffect, useRef, useState } from "react";
import AppNav from "@/components/AppNav";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

function normalizeEmailFromSpeech(raw: string): string {
  let s = raw.toLowerCase().trim();
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
  s = s.replace(/\s+/g, "");
  return s;
}

function normNameClient(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function PeoplePage() {
  const router = useRouter();

  const [timeline, setTimeline] = useState<any>(null);

  const [people, setPeople] = useState<any[]>([]);
  const [mentions, setMentions] = useState<any[]>([]);

  // Scan B
  const [scanCandidates, setScanCandidates] = useState<any[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [selectedCandidateNorms, setSelectedCandidateNorms] = useState<Set<string>>(new Set());

  // Contact editor
  const [editingContactPersonId, setEditingContactPersonId] = useState<string | null>(null);
  const [cPhone, setCPhone] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cSocialType, setCSocialType] =
    useState<"facebook" | "instagram" | "x" | "linkedin" | "tiktok" | "other" | "">("");
  const [cSocialHandle, setCSocialHandle] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Dictée
  const recognitionRef = useRef<any>(null);
  const lastFinalChunkRef = useRef<string>("");
  const dictationSessionRef = useRef<string>("");

  const [isDictating, setIsDictating] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [autoReadAfterDictation, setAutoReadAfterDictation] = useState(true);

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

  function applyDictation(field: string, transcript: string) {
    switch (field) {
      case "cPhone":
        return setCPhone(transcript);
      case "cEmail":
        return setCEmail(normalizeEmailFromSpeech(transcript));
      case "cSocialHandle":
        return setCSocialHandle(transcript);
      case "cNotes":
        return setCNotes((prev) => (prev ? prev + "\n" : "") + transcript);
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

    recognition.onstart = () => setIsDictating(true);

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (!res.isFinal) continue;

        const t = String(res[0]?.transcript || "").trim();
        if (!t) continue;

        if (t === lastFinalChunkRef.current) continue;
        lastFinalChunkRef.current = t;

        applyDictation(field, t);

        dictationSessionRef.current = dictationSessionRef.current
          ? dictationSessionRef.current + " " + t
          : t;
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

      // lecture auto même si Chrome stoppe tout seul
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
      setSelectedCandidateNorms(new Set());
    } finally {
      setScanLoading(false);
    }
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/");
        return;
      }

      const { data: timelines, error } = await supabase.from("timelines").select("id,title").limit(1);
      if (error || !timelines?.[0]) {
        alert(error?.message || "Timeline introuvable");
        return;
      }

      setTimeline(timelines[0]);
      await Promise.all([refreshPeople(timelines[0].id), refreshMentions(timelines[0].id)]);
    });
  }, [router]);

  return (
    <main   style={{ maxWidth: 980, margin: "30px auto", padding: 16, fontFamily: "system-ui" }}>
    <div style={{ padding: 16 }}>
      <AppNav />

      <h1 style={{ marginTop: 0 }}>Personnes</h1>

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

      {/* Scanner */}
      <section className="glass" style={{ marginTop: 18, padding: 14 }}>
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
                          {Array.isArray(c.sources)
                            ? c.sources.slice(0, 3).map((s: any, i: number) => (
                                <div key={i}>
                                  • {s.source_type} ({String(s.source_id).slice(0, 6)}…): {s.excerpt}
                                </div>
                              ))
                            : null}
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
              <button
                onClick={() => {
                  setScanCandidates([]);
                  setSelectedCandidateNorms(new Set());
                }}
                style={{ cursor: "pointer", padding: "10px 14px" }}
              >
                Fermer
              </button>
            </div>
          </>
        ) : null}
      </section>

      {/* Liste people + contacts */}
      <section className="glass" style={{ marginTop: 18, padding: 14 }}>
        <h2>Annuaire</h2>

        {people.length === 0 ? (
          <p>Aucune personne.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
            {people.map((p) => (
              <li key={p.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{p.display_name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {p.phone ? `Tel: ${p.phone}` : ""}
                      {p.email ? ` • ${p.email}` : ""}
                      {p.social_type && p.social_handle ? ` • ${p.social_type}: ${p.social_handle}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => openContactEditor(p)} style={{ cursor: "pointer" }}>
                      📇
                    </button>
                  </div>
                </div>

                {editingContactPersonId === p.id ? (
                  <div style={{ marginTop: 12, borderTop: "1px solid #eee", paddingTop: 12 }}>
                    <div style={{ fontWeight: 800, marginBottom: 10 }}>Contact</div>

                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 14, fontWeight: 700 }}>Téléphone</label>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                        <input
                          value={cPhone}
                          onChange={(e) => setCPhone(e.target.value)}
                          placeholder="+33…"
                          style={{ flex: 1, padding: 12, minWidth: 0 }}
                        />
                        {isDictating && activeField === "cPhone" ? (
                          <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸</button>
                        ) : (
                          <button onClick={() => startDictationFor("cPhone")} style={{ cursor: "pointer" }}>🎙️</button>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 14, fontWeight: 700 }}>Email</label>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                        <input
                          value={cEmail}
                          onChange={(e) => setCEmail(e.target.value)}
                          placeholder="nom@domaine.fr"
                          style={{ flex: 1, padding: 12, minWidth: 0 }}
                        />
                        {isDictating && activeField === "cEmail" ? (
                          <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸</button>
                        ) : (
                          <button onClick={() => startDictationFor("cEmail")} style={{ cursor: "pointer" }}>🎙️</button>
                        )}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                        Astuce dictée : “paul point martin arobase gmail point com”
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 14, fontWeight: 700 }}>Réseau social</label>
                      <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                        <select
                          value={cSocialType}
                          onChange={(e) => setCSocialType(e.target.value as any)}
                          style={{ padding: 12 }}
                        >
                          <option value="">—</option>
                          <option value="facebook">Facebook</option>
                          <option value="instagram">Instagram</option>
                          <option value="x">X</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="tiktok">TikTok</option>
                          <option value="other">Autre</option>
                        </select>

                        <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1, minWidth: 220 }}>
                          <input
                            value={cSocialHandle}
                            onChange={(e) => setCSocialHandle(e.target.value)}
                            placeholder="@pseudo ou URL"
                            style={{ flex: 1, padding: 12, minWidth: 0 }}
                          />
                          {isDictating && activeField === "cSocialHandle" ? (
                            <button onClick={stopDictation} style={{ cursor: "pointer" }}>⏸</button>
                          ) : (
                            <button onClick={() => startDictationFor("cSocialHandle")} style={{ cursor: "pointer" }}>🎙️</button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 14, fontWeight: 700 }}>Notes</label>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 6 }}>
                        <textarea
                          value={cNotes}
                          onChange={(e) => setCNotes(e.target.value)}
                          placeholder="Contexte, lien avec Mee…"
                          style={{ flex: 1, padding: 12, minHeight: 90, minWidth: 0 }}
                        />
                        {isDictating && activeField === "cNotes" ? (
                          <button onClick={stopDictation} style={{ cursor: "pointer", height: 42 }}>⏸</button>
                        ) : (
                          <button onClick={() => startDictationFor("cNotes")} style={{ cursor: "pointer", height: 42 }}>🎙️</button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      <button onClick={saveContact} style={{ cursor: "pointer", padding: "10px 14px" }}>
                        💾 Enregistrer
                      </button>
                      <button onClick={() => setEditingContactPersonId(null)} style={{ cursor: "pointer", padding: "10px 14px" }}>
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