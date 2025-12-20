import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const run = async () => {
      // Se arriva un code nel redirect, scambialo per una sessione
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      }
      navigate("/dashboard");
    };

    run();
  }, [navigate]);

  return <div style={{ padding: 24 }}>Completamento accesso…</div>;
}

