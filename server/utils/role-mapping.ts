/**
 * Mappa ruoli legacy dal database ai nuovi ruoli standardizzati
 * 
 * MODELLO AUTENTICAZIONE E AUTORIZZAZIONE
 * 
 * ORGANIZZAZIONI (type scelto alla registrazione):
 * - buyer: compra prodotti/servizi → tutti membri vanno a /buyer
 * - vendor: vende prodotti → membri admin/vendor vanno a /admin/catalogo
 * - operator: fornisce servizi operativi → membri admin/operator vanno a /admin/prenotazioni
 * 
 * RUOLI UTENTE (gerarchia):
 * - admin: grado gerarchico (tutti iniziano così)
 * - vendor: ruolo funzionale (solo per org vendor)
 * - operator: ruolo funzionale (solo per org vendor/operator)
 * - dispatcher: ruolo funzionale (solo per org vendor/operator)
 * 
 * LOGICA INVITI:
 * - Buyer org: possono invitare solo admin
 * - Vendor/Operator org: possono invitare admin/vendor/operator/dispatcher
 */

/**
 * Mappa ruolo legacy (dal database) al nuovo ruolo standardizzato
 * @param legacyRole Ruolo legacy dal database (es. "VENDOR_ADMIN", "PILOT", ecc.)
 * @param orgType Tipo organizzazione (es. "vendor", "buyer", "operator")
 * @returns Ruolo standardizzato: "admin" | "vendor" | "operator" | "dispatcher"
 */
export function mapLegacyRoleToNewRole(legacyRole: string | null | undefined, orgType?: string): string {
  if (!legacyRole) {
    return 'admin'; // Default a admin se non specificato
  }

  const roleUpper = String(legacyRole).toUpperCase().trim();

  // Mappatura ruoli legacy ai nuovi ruoli
  const roleMapping: Record<string, string> = {
    // Ruoli admin (tutti i ruoli admin legacy → admin)
    'VENDOR_ADMIN': 'admin',
    'BUYER_ADMIN': 'admin',
    'ADMIN': 'admin',
    
    // Ruoli dispatcher (già corretto)
    'DISPATCHER': 'dispatcher',
    
    // Ruoli operator/pilot (PILOT → operator)
    'PILOT': 'operator',
    'OPERATOR': 'operator',
    
    // Ruoli vendor/sales (SALES → vendor per org vendor)
    'SALES': orgType === 'vendor' ? 'vendor' : 'admin', // Se org vendor, mappa a vendor, altrimenti admin
    'VENDOR': 'vendor',
  };

  // Se esiste una mappatura diretta, usala
  if (roleMapping[roleUpper]) {
    return roleMapping[roleUpper];
  }

  // Se il ruolo è già nel formato nuovo (minuscolo), normalizzalo
  const roleLower = String(legacyRole).toLowerCase().trim();
  if (['admin', 'vendor', 'operator', 'dispatcher'].includes(roleLower)) {
    return roleLower;
  }

  // Controlla se il ruolo contiene "admin" (per ruoli come vendor_admin, buyer_admin)
  if (roleLower.includes('admin')) {
    return 'admin';
  }

  // Default: admin per sicurezza
  console.warn(`⚠️  Ruolo legacy non mappato: "${legacyRole}", usando default "admin"`);
  return 'admin';
}

/**
 * Determina se un ruolo è admin (grado gerarchico)
 * @param role Ruolo standardizzato
 * @returns true se il ruolo è admin
 */
export function isAdminRole(role: string): boolean {
  return role === 'admin';
}

/**
 * Determina capabilities da orgType e userRole
 * NUOVA LOGICA: capabilities derivano dal ruolo utente, non dall'organizzazione
 * @param orgType Tipo organizzazione
 * @param userRole Ruolo utente standardizzato
 * @returns Capabilities object con permessi di accesso
 */
export function deriveCapabilities(orgType: string, userRole: string) {
  const role = userRole.toLowerCase();
  const org = orgType.toLowerCase();

  // Base permissions per tutti
  const capabilities = {
    // Legacy permissions (per backward compatibility)
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
    can_complete_missions: false
  };

  // Admin: accesso completo a tutto
  if (role === 'admin') {
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

  // Dispatcher: accesso completo a tutto (come admin ma forse senza gestione utenti)
  if (role === 'dispatcher') {
    capabilities.can_buy = org === 'buyer';
    capabilities.can_sell = org === 'vendor';
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

  // Vendor: accesso a catalogo e ordini (per gestire prodotti)
  if (role === 'vendor' && org === 'vendor') {
    capabilities.can_buy = org === 'buyer';
    capabilities.can_sell = true;
    capabilities.can_access_admin = true;
    capabilities.can_access_catalog = true;
    capabilities.can_access_orders = true;
    capabilities.can_send_messages = true;
    return capabilities;
  }

  // Operator: accesso a prenotazioni e servizi (per gestire operazioni)
  if (role === 'operator' && (org === 'operator' || org === 'vendor')) {
    capabilities.can_buy = org === 'buyer';
    capabilities.can_sell = org === 'vendor';
    capabilities.can_operate = true;
    capabilities.can_access_admin = true;
    capabilities.can_access_services = true;
    capabilities.can_access_bookings = true;
    capabilities.can_send_messages = true;
    capabilities.can_complete_missions = true;
    return capabilities;
  }

  // Buyer: solo acquisto
  if (org === 'buyer') {
    capabilities.can_buy = true;
    return capabilities;
  }

  return capabilities;
}

