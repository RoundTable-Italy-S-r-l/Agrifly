/**
 * Utility centralizzata per gestire redirect e migrazione carrello dopo login/registrazione
 */

import { QueryClient } from "@tanstack/react-query";
import { migrateCart } from "./api";

interface RedirectOptions {
  organization: any;
  user: any;
  queryClient: QueryClient;
  navigate: (path: string, options?: { replace?: boolean }) => void;
}

/**
 * Migra il carrello guest se esiste
 */
export async function migrateGuestCart(
  organization: any,
  user: any,
  queryClient: QueryClient,
): Promise<void> {
  const sessionId = localStorage.getItem("session_id");
  if (sessionId && user?.id && organization?.id) {
    try {
      console.log("🛒 Migrazione carrello guest...", {
        sessionId,
        userId: user.id,
        orgId: organization.id,
      });
      const migrateResult = await migrateCart(
        sessionId,
        user.id,
        organization.id,
      );
      console.log("📦 Risultato migrazione:", migrateResult);
      localStorage.removeItem("session_id");
      localStorage.removeItem("guest_org_id");
      console.log("✅ Carrello migrato con successo");
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    } catch (err) {
      console.error("⚠️ Errore migrazione carrello (non critico):", err);
      // Non bloccare il flusso se la migrazione fallisce
    }
  }
}

/**
 * Gestisce redirect speciali (carrello, nuovo-preventivo, percorsi completi)
 * Restituisce true se ha gestito un redirect, false altrimenti
 */
export function handleSpecialRedirects(
  organization: any,
  navigate: (path: string, options?: { replace?: boolean }) => void,
): boolean {
  const postLoginRedirect = localStorage.getItem("post_login_redirect");

  if (!postLoginRedirect) {
    return false;
  }

  const orgType = organization.type || organization.org_type;

  // Redirect a nuovo-preventivo (solo buyer)
  if (postLoginRedirect === "nuovo-preventivo" && orgType === "buyer") {
    const tempFieldData = localStorage.getItem("temp_field_data");
    if (tempFieldData) {
      localStorage.setItem("pending_field_data", tempFieldData);
      localStorage.removeItem("temp_field_data");
      console.log("📋 Field data transferred to pending for nuovo-preventivo");
    }
    localStorage.removeItem("post_login_redirect");
    console.log("🚀 Redirect speciale: /buyer/nuovo-preventivo");
    navigate("/buyer/nuovo-preventivo", { replace: true });
    return true;
  }

  // Redirect al carrello (solo buyer)
  if (
    (postLoginRedirect === "carrello" ||
      postLoginRedirect === "/buyer/carrello" ||
      postLoginRedirect?.includes("carrello")) &&
    orgType === "buyer"
  ) {
    localStorage.removeItem("post_login_redirect");
    console.log("🛒 Redirect speciale: /buyer/carrello");
    navigate("/buyer/carrello", { replace: true });
    return true;
  }

  // Redirect a percorso completo (es. /admin/catalogo)
  if (postLoginRedirect && postLoginRedirect.startsWith("/")) {
    localStorage.removeItem("post_login_redirect");
    console.log(`🔄 Redirect a percorso specifico: ${postLoginRedirect}`);
    navigate(postLoginRedirect, { replace: true });
    return true;
  }

  return false;
}

/**
 * Determina la dashboard in base al tipo organizzazione
 * SEMPLIFICATO: provider sempre /admin
 */
export function getDashboardPath(organization: any): string {
  const orgType = organization.type || organization.org_type;

  if (orgType === "buyer") {
    return "/buyer";
  } else if (orgType === "provider") {
    return "/admin";
  } else {
    // Fallback per retrocompatibilità: vendor/operator → provider
    if (orgType === "vendor" || orgType === "operator") {
      return "/admin";
    }
    console.warn("⚠️ Tipo organizzazione sconosciuto:", orgType);
    return "/dashboard";
  }
}

/**
 * Gestisce il redirect completo dopo login/registrazione
 */
export async function handlePostAuthRedirect(
  options: RedirectOptions,
): Promise<void> {
  const { organization, user, queryClient, navigate } = options;

  // Se email non verificata, redirect a verifica (mantiene post_login_redirect)
  if (!user?.email_verified) {
    console.log("📧 Email non verificata, redirect a /verify-email");
    navigate("/verify-email", { replace: true });
    return;
  }

  // Migra carrello guest se email già verificata
  await migrateGuestCart(organization, user, queryClient);

  // Gestisci redirect speciali
  if (handleSpecialRedirects(organization, navigate)) {
    return;
  }

  // Redirect normale alla dashboard
  const dashboardPath = getDashboardPath(organization);
  console.log(`🚀 Redirect a dashboard: ${dashboardPath}`);
  navigate(dashboardPath, { replace: true });
}

/**
 * Salva il percorso corrente come redirect per dopo il login
 */
export function saveCurrentPathAsRedirect(): void {
  const currentPath = window.location.pathname + window.location.search;
  // Non salvare se siamo già in login o in una pagina di auth
  // Salva anche la home (/) perché dopo login l'utente vuole tornare lì (ora loggato)
  if (
    !currentPath.startsWith("/login") &&
    !currentPath.startsWith("/reset-password") &&
    !currentPath.startsWith("/verify-email") &&
    !currentPath.startsWith("/accept-invite")
  ) {
    localStorage.setItem("post_login_redirect", currentPath);
    console.log("💾 Salvato redirect:", currentPath);
  }
}
