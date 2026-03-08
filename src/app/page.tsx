"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/dashboard");
    });
  }, [router]);

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert("Compte créé.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else router.push("/dashboard");
  }

  return (
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Meemorize App</h1>
      <p>Connexion / inscription</p>

      <label>Email</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="mee@example.com"
      />

      <label>Mot de passe</label>
      <input
        style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="********"
      />

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={signIn} style={{ padding: "10px 14px", cursor: "pointer" }}>
          Se connecter
        </button>
        <button onClick={signUp} style={{ padding: "10px 14px", cursor: "pointer" }}>
          Créer un compte
        </button>
      </div>
    </main>
  );
}
