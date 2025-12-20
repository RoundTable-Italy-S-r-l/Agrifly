import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Completo accesso...");

  useEffect(() => {
    const run = async () => {
      try {
        const url = window.location.href;

        // se c'è code=..., scambia il code per una sessione
        if (url.includes("code=")) {
          const { error } = await supabase.auth.exchangeCodeForSession(url);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          navigate("/dashboard", { replace: true });
          return;
        }

        setMsg("Sessione non trovata. Riprova login.");
      } catch (e: any) {
        setMsg(e?.message || "Errore callback");
      }
    };

    run();
  }, [navigate]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Auth callback</h1>
      <p>{msg}</p>
    </div>
  );
}
