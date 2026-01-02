const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Test data builders
class TestDataFactory {
  constructor() {
    this.createdRecords = [];
  }

  async createOrg(overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const org = {
      id: `test-org-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      legal_name: `Test Org ${Date.now()}`,
      kind: overrides.kind || 'VENDOR',
      address_line: 'Via Test 123',
      city: 'Test City',
      province: 'TN',
      postal_code: '38051',
      country: 'IT',
      ...overrides
    };

    const { data, error } = await supabase
      .from('organizations')
      .insert(org)
      .select()
      .single();

    if (error && !error.message.includes('already exists')) {
      throw error;
    }

    if (data) {
      this.createdRecords.push({ type: 'organization', id: data.id });
      return data;
    }

    // Se esiste già, recuperalo
    const { data: existing } = await supabase
      .from('organizations')
      .select()
      .eq('id', org.id)
      .single();

    return existing || org;
  }

  async createProduct(overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const product = {
      id: `test-prd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `Test Product ${Date.now()}`,
      brand: 'Test Brand',
      model: 'Test Model',
      product_type: 'DRONE',
      status: 'ACTIVE',
      specs_json: JSON.stringify({}),
      images_json: JSON.stringify([]),
      ...overrides
    };

    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;

    this.createdRecords.push({ type: 'product', id: data.id });
    return data;
  }

  async createInventory(orgId, productId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    // Prima crea SKU se non esiste
    let skuId = overrides.sku_id;
    
    if (!skuId) {
      const newSkuId = `test-sku-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { data: newSku, error: skuError } = await supabase
        .from('skus')
        .insert({
          id: newSkuId,
          product_id: productId,
          sku_code: `SKU-${Date.now()}`,
          variant_tags: []  // PostgreSQL array, non JSON string
        })
        .select()
        .single();

      if (skuError && !skuError.message.includes('duplicate')) {
        throw skuError;
      }

      skuId = newSku?.id || newSkuId;
      this.createdRecords.push({ type: 'sku', id: skuId });
    }

    // Crea location se non specificata
    let locationId = overrides.location_id;
    if (!locationId) {
      try {
        const { data: locations } = await supabase
          .from('locations')
          .select('id')
          .limit(1);
        if (locations && locations.length > 0) {
          locationId = locations[0].id;
        } else {
          // Crea location di default se non esiste
          const { data: newLocation } = await supabase
            .from('locations')
            .insert({
              id: `test-loc-${Date.now()}`,
              vendor_org_id: orgId,
              name: 'Test Location',
              address_line: 'Test Address',
              city: 'Test City',
              postal_code: '38051'
            })
            .select()
            .single();
          locationId = newLocation?.id;
        }
      } catch (e) {
        // Se locations table non esiste o ha problemi, usa null
        locationId = null;
      }
    }

    const inventory = {
      id: `test-inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendor_org_id: orgId,
      sku_id: skuId,
      location_id: locationId,
      qty_on_hand: overrides.qty_on_hand || 100, // Stock alto per test
      qty_reserved: overrides.qty_reserved || 0,
      ...overrides
    };

    const { data, error } = await supabase
      .from('inventories')
      .insert(inventory)
      .select()
      .single();

    if (error) throw error;

    this.createdRecords.push({ type: 'inventory', id: data.id });
    return data;
  }

  async createVendorCatalogItem(orgId, skuId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const item = {
      id: `test-vci-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vendor_org_id: orgId,
      sku_id: skuId,
      is_for_sale: overrides.is_for_sale !== undefined ? overrides.is_for_sale : true,
      is_for_rent: false,
      lead_time_days: 7,
      ...overrides
    };

    const { data, error } = await supabase
      .from('vendor_catalog_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;

    this.createdRecords.push({ type: 'vendor_catalog_item', id: data.id });
    return data;
  }

  async cleanup() {
    if (!supabase) return;

    // Pulisci in ordine inverso (per evitare FK constraints)
    const order = ['offers', 'vendor_catalog_items', 'inventories', 'skus', 'products', 'organizations'];
    
    for (const type of order) {
      for (const record of this.createdRecords.filter(r => r.type === type.replace('s', '').replace('ies', 'y'))) {
        try {
          await supabase.from(type).delete().eq('id', record.id);
        } catch (e) {
          // Ignora errori di cleanup
        }
      }
    }

    this.createdRecords = [];
  }

  // Helper per verificare che un record esista nel DB
  async verifyRecordExists(table, id, expectedFields = {}) {
    if (!supabase) return false;

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return false;

    // Verifica campi attesi
    for (const [key, value] of Object.entries(expectedFields)) {
      if (data[key] !== value) {
        return false;
      }
    }

    return true;
  }

  // Helper per verificare che un record sia stato modificato
  async verifyRecordUpdated(table, id, updates) {
    if (!supabase) return false;

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return false;

    // Verifica che i campi siano stati aggiornati
    for (const [key, value] of Object.entries(updates)) {
      if (data[key] !== value) {
        return { match: false, actual: data[key], expected: value, field: key };
      }
    }

    return { match: true };
  }

  async createJob(orgId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const jobId = `test-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job = {
      id: jobId,
      buyer_org_id: orgId,
      field_name: overrides.field_name || `Test Field ${Date.now()}`,
      service_type: overrides.service_type || 'SPRAY',
      area_ha: overrides.area_ha || 10,
      location_json: overrides.location_json || { coordinates: [11.0, 46.0] },
      status: overrides.status || 'OPEN',
      ...overrides
    };

    // Prova prima con Supabase
    try {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          id: job.id,
          buyer_org_id: job.buyer_org_id,
          field_name: job.field_name,
          service_type: job.service_type,
          area_ha: job.area_ha,
          location_json: typeof job.location_json === 'string' ? job.location_json : JSON.stringify(job.location_json),
          status: job.status
        })
        .select()
        .single();

      if (!error && data) {
        this.createdRecords.push({ type: 'job', id: jobId });
        return data;
      }
    } catch (e) {
      // Ignora - prosegui con mock
    }

    // Se Supabase fallisce, restituisci comunque il job mock per i test
    // I test useranno questo ID e l'endpoint creerà il job
    this.createdRecords.push({ type: 'job', id: jobId });
    return job;
  }

  async createJobOffer(jobId, vendorOrgId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const offerId = `test-offer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const offer = {
      id: offerId,
      job_id: jobId,
      provider_org_id: vendorOrgId,
      total_cents: overrides.total_cents || 50000,
      currency: overrides.currency || 'EUR',
      status: overrides.status || 'PENDING',
      ...overrides
    };

    try {
      const { data, error } = await supabase
        .from('job_offers')
        .insert(offer)
        .select()
        .single();

      if (!error && data) {
        this.createdRecords.push({ type: 'job_offer', id: offerId });
        return data;
      }
    } catch (error) {
      // Ignora - prosegui con mock
    }

    // Se Supabase fallisce, restituisci comunque l'offer mock per i test
    this.createdRecords.push({ type: 'job_offer', id: offerId });
    return offer;
  }

  async createOperator(orgId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const operatorId = `test-op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const serviceTags = overrides.service_tags || ['SPRAY'];
    const operator = {
      id: operatorId,
      org_id: orgId,
      user_id: overrides.user_id || null,
      service_tags: Array.isArray(serviceTags) ? serviceTags : (typeof serviceTags === 'string' ? JSON.parse(serviceTags) : ['SPRAY']),
      status: overrides.status || 'ACTIVE',
      ...overrides
    };

    // Prova prima con Supabase
    try {
      const { data, error } = await supabase
        .from('operator_profiles')
        .insert({
          id: operator.id,
          org_id: operator.org_id,
          user_id: operator.user_id,
          service_tags: operator.service_tags, // Supabase gestisce array/jsonb
          status: operator.status
        })
        .select()
        .single();

      if (!error && data) {
        this.createdRecords.push({ type: 'operator', id: operatorId });
        return data;
      }
    } catch (e) {
      // Ignora - prosegui con mock
    }

    // Se Supabase fallisce, restituisci comunque l'operator mock per i test
    this.createdRecords.push({ type: 'operator', id: operatorId });
    return operator;
  }

  async createAddress(orgId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const addressId = `addr_${Date.now()}${Math.random().toString(36).substr(2, 9)}`.substring(0, 30);
    const address = {
      id: addressId,
      org_id: orgId,
      type: overrides.type || 'SHIPPING',
      name: overrides.name || `Test Address ${Date.now()}`,
      address_line: overrides.address_line || 'Via Test 123',
      city: overrides.city || 'Test City',
      province: overrides.province || 'TN',
      postal_code: overrides.postal_code || '38051',
      country: overrides.country || 'IT',
      is_default: overrides.is_default || false,
      ...overrides
    };

    try {
      const { data, error } = await supabase
        .from('addresses')
        .insert(address)
        .select()
        .single();

      if (!error && data) {
        this.createdRecords.push({ type: 'address', id: addressId });
        return data;
      }
    } catch (e) {
      // Ignora - prosegui con mock
    }

    this.createdRecords.push({ type: 'address', id: addressId });
    return address;
  }

  async createNotificationPreferences(userId, overrides = {}) {
    if (!supabase) throw new Error('Supabase not available');

    const prefs = {
      user_id: userId,
      email_orders: overrides.email_orders !== undefined ? overrides.email_orders : true,
      email_payments: overrides.email_payments !== undefined ? overrides.email_payments : true,
      email_updates: overrides.email_updates !== undefined ? overrides.email_updates : true,
      ...overrides
    };

    try {
      const { data, error } = await supabase
        .from('user_notification_preferences')
        .upsert(prefs, { onConflict: 'user_id' })
        .select()
        .single();

      if (!error && data) {
        this.createdRecords.push({ type: 'notification_preference', id: data.id || userId });
        return data;
      }
    } catch (e) {
      // Ignora se la tabella non esiste
    }

    // Restituisci comunque i prefs per i test
    return prefs;
  }
}

module.exports = { TestDataFactory };

