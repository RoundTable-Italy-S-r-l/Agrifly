import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [msg, setMsg] = useState("Completo autenticazione...");

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const errorDesc =
          url.searchParams.get("error_description") || url.searchParams.get("error");

        if (errorDesc) {
          setMsg(`Errore callback: ${errorDesc}`);
          return;
        }

        // PKCE flow: Supabase redirecta con ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // A questo punto: se la mail era signup-confirm, l’utente è confermato
        // e (se presente sessione) è anche loggato.
        setMsg("Autenticazione completata. Reindirizzo al login...");
        setTimeout(() => navigate("/login", { replace: true }), 700);
      } catch (e: any) {
        setMsg(e?.message || "Errore callback");
      }
    })();
  }, [navigate]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Auth Callback</h1>
      <p>{msg}</p>
    </div>
  );
}


