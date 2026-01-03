/**
 * Mappa ruoli legacy dal database ai nuovi ruoli standardizzati
 *
 * 🚀 NUOVA LOGICA COMPLETAMENTE BASATA SU RUOLI UTENTE
 *
 * ORGANIZZAZIONI (type scelto alla registrazione - SOLO per routing):
 * - buyer: compra prodotti/servizi → tutti membri vanno a /buyer
 * - provider: vende prodotti e offre servizi → membri vanno a /admin
 *
 * RUOLI UTENTE (gerarchia - PERMESSI TOTALMENTE SUGLI UTENTI):
 * - admin: grado gerarchico - ACCESSO COMPLETO A TUTTO
 * - dispatcher: grado gerarchico - ACCESSO COMPLETO A TUTTO
 * - vendor: ruolo funzionale - CATALOGO + ORDINI (sempre!)
 * - operator: ruolo funzionale - SERVIZI + PRENOTAZIONI + MISSIONI (sempre!)
 *
 * ✅ I permessi derivano SOLO dal ruolo utente, NON dal tipo organizzazione!
 *
 * LOGICA INVITI:
 * - Buyer org: possono invitare solo admin (per sicurezza)
 * - Provider org: possono invitare admin/vendor/operator/dispatcher
 */

/**
 * Mappa ruolo legacy (dal database) al nuovo ruolo standardizzato
 * @param legacyRole Ruolo legacy dal database (es. "VENDOR_ADMIN", "PILOT", ecc.)
 * @param orgType Tipo organizzazione (es. "provider", "buyer")
 * @returns Ruolo standardizzato: "admin" | "vendor" | "operator" | "dispatcher"
 */
export function mapLegacyRoleToNewRole(
  legacyRole: string | null | undefined,
  orgType?: string,
): string {
  if (!legacyRole) {
    return "admin"; // Default a admin se non specificato
  }

  const roleUpper = String(legacyRole).toUpperCase().trim();

  // Mappatura ruoli legacy ai nuovi ruoli
  const roleMapping: Record<string, string> = {
    // Ruoli admin (tutti i ruoli admin legacy → admin)
    VENDOR_ADMIN: "admin",
    BUYER_ADMIN: "admin",
    ADMIN: "admin",

    // Ruoli dispatcher (già corretto)
    DISPATCHER: "dispatcher",

    // Ruoli operator/pilot (PILOT → operator)
    PILOT: "operator",
    OPERATOR: "operator",

    // Ruoli vendor/sales (SALES → vendor per org provider/vendor)
    SALES: orgType === "provider" || orgType === "vendor" ? "vendor" : "admin", // Se org provider/vendor, mappa a vendor, altrimenti admin
    VENDOR: "vendor",
  };

  // Se esiste una mappatura diretta, usala
  if (roleMapping[roleUpper]) {
    return roleMapping[roleUpper];
  }

  // Se il ruolo è già nel formato nuovo (minuscolo), normalizzalo
  const roleLower = String(legacyRole).toLowerCase().trim();
  if (["admin", "vendor", "operator", "dispatcher"].includes(roleLower)) {
    return roleLower;
  }

  // Controlla se il ruolo contiene "admin" (per ruoli come vendor_admin, buyer_admin)
  if (roleLower.includes("admin")) {
    return "admin";
  }

  // Default: admin per sicurezza
  console.warn(
    `⚠️  Ruolo legacy non mappato: "${legacyRole}", usando default "admin"`,
  );
  return "admin";
}

/**
 * Determina se un ruolo è admin (grado gerarchico)
 * @param role Ruolo standardizzato
 * @returns true se il ruolo è admin
 */
export function isAdminRole(role: string): boolean {
  return role === "admin";
}

/**
 * Determina capabilities dal RUOLO UTENTE (NON più dal tipo organizzazione)
 * LOGICA COMPLETAMENTE BASATA SU RUOLI: permessi derivano SOLO dal ruolo utente
 * @param orgType Tipo organizzazione (solo per backward compatibility legacy)
 * @param userRole Ruolo utente standardizzato
 * @returns Capabilities object con permessi di accesso
 */
export function deriveCapabilities(orgType: string, userRole: string) {
  const role = userRole.toLowerCase();

  // Base permissions per tutti
  const capabilities = {
    // Legacy permissions (ora completamente basate sul ruolo utente)
    can_buy: false,
    can_sell: false,
    can_operate: false,
    can_dispatch: false,

    // New section access permissions
    can_access_admin: false,
    can_access_catalog: false,
    can_access_orders: false,
    can_access_services: false,
    can_access_bookings: false,
    can_manage_users: false,
    can_send_messages: false,
    can_complete_missions: false,
  };

  // 🚀 NUOVA LOGICA: PERMESSI BASATI SOLO SUL RUOLO UTENTE

  // Admin: accesso completo a tutto (grado gerarchico)
  if (role === "admin") {
    capabilities.can_buy = true;
    capabilities.can_sell = true;
    capabilities.can_operate = true;
    capabilities.can_dispatch = true;
    capabilities.can_access_admin = true;
    capabilities.can_access_catalog = true;
    capabilities.can_access_orders = true;
    capabilities.can_access_services = true;
    capabilities.can_access_bookings = true;
    capabilities.can_manage_users = true;
    capabilities.can_send_messages = true;
    capabilities.can_complete_missions = true;
    return capabilities;
  }

  // Dispatcher: accesso completo a tutto (grado gerarchico)
  if (role === "dispatcher") {
    capabilities.can_buy = true;
    capabilities.can_sell = true;
    capabilities.can_operate = true;
    capabilities.can_dispatch = true;
    capabilities.can_access_admin = true;
    capabilities.can_access_catalog = true;
    capabilities.can_access_orders = true;
    capabilities.can_access_services = true;
    capabilities.can_access_bookings = true;
    capabilities.can_send_messages = true;
    capabilities.can_complete_missions = true;
    return capabilities;
  }

  // Vendor: ruolo funzionale per gestire prodotti/catalogo
  if (role === "vendor") {
    capabilities.can_buy = true; // Può comprare per l'organizzazione
    capabilities.can_sell = true; // Può vendere prodotti
    capabilities.can_access_admin = true;
    capabilities.can_access_catalog = true; // Gestione catalogo prodotti
    capabilities.can_access_orders = true; // Gestione ordini
    capabilities.can_send_messages = true;
    return capabilities;
  }

  // Operator: ruolo funzionale per gestire operazioni/prenotazioni
  if (role === "operator") {
    capabilities.can_buy = true; // Può comprare per l'organizzazione
    capabilities.can_operate = true; // Può eseguire operazioni
    capabilities.can_access_admin = true;
    capabilities.can_access_services = true; // Gestione servizi
    capabilities.can_access_bookings = true; // Gestione prenotazioni
    capabilities.can_send_messages = true;
    capabilities.can_complete_missions = true; // Può completare missioni
    return capabilities;
  }

  // Buyer: ruolo di default per chi compra
  // (Questo potrebbe non servire più, ma mantenuto per backward compatibility)
  capabilities.can_buy = true;
  return capabilities;
}
