import { query } from './database';

function generateId(prefix: string = 'resp'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}_${timestamp}${random}`.substring(0, 30);
}

/**
 * Calcola i tempi di risposta per una conversation
 * Implementa la regola: blocchi consecutivi, solo conversation OPEN, calcolo per coppia org
 */
export async function calculateResponseEventsForConversation(conversationId: string): Promise<number> {
  // Verifica che la conversation sia OPEN
  const convCheck = await query(`
    SELECT id, status FROM conversations WHERE id = $1
  `, [conversationId]);
  
  if (convCheck.rows.length === 0) {
    console.log(`⚠️  Conversation ${conversationId} non trovata`);
    return 0;
  }
  
  if (convCheck.rows[0].status !== 'OPEN') {
    console.log(`⚠️  Conversation ${conversationId} non è OPEN (status: ${convCheck.rows[0].status})`);
    return 0;
  }
  
  // STEP 1: Ottieni tutti i messaggi con sender_org_id e operator_profile_id
  const messagesWithOrg = await query(`
    SELECT 
      m.id as message_id,
      m.conversation_id,
      m.sender_user_id,
      m.created_at,
      cp.org_id as sender_org_id,
      op.id as operator_profile_id
    FROM messages m
    JOIN conversation_participants cp ON cp.conversation_id = m.conversation_id
    JOIN org_memberships om ON om.user_id = m.sender_user_id 
      AND om.org_id = cp.org_id 
      AND om.is_active = true
    LEFT JOIN operator_profiles op ON op.user_id = m.sender_user_id 
      AND op.org_id = cp.org_id
      AND op.status = 'ACTIVE'
    WHERE m.conversation_id = $1
    ORDER BY m.created_at ASC
  `, [conversationId]);
  
  if (messagesWithOrg.rows.length < 2) {
    // Serve almeno 2 messaggi per calcolare una risposta
    return 0;
  }
  
  // STEP 2: Identifica blocchi consecutivi (stessa org)
  interface MessageBlock {
    message_id: string;
    sender_user_id: string;
    sender_org_id: string;
    operator_profile_id: string | null;
    created_at: Date;
    block_id: number;
  }
  
  const blocks: MessageBlock[] = [];
  let currentBlockId = 0;
  let prevOrgId: string | null = null;
  
  for (const msg of messagesWithOrg.rows) {
    const msgOrgId = msg.sender_org_id;
    
    // Se cambia org, inizia un nuovo blocco
    if (prevOrgId !== msgOrgId) {
      currentBlockId++;
    }
    
    blocks.push({
      message_id: msg.message_id,
      sender_user_id: msg.sender_user_id,
      sender_org_id: msgOrgId,
      operator_profile_id: msg.operator_profile_id || null,
      created_at: new Date(msg.created_at),
      block_id: currentBlockId
    });
    
    prevOrgId = msgOrgId;
  }
  
  // STEP 3: Per ogni blocco, trova l'ultimo messaggio
  const blockLastMessages = new Map<number, MessageBlock>();
  for (const block of blocks) {
    const existing = blockLastMessages.get(block.block_id);
    if (!existing || block.created_at > existing.created_at) {
      blockLastMessages.set(block.block_id, block);
    }
  }
  
  // STEP 4: Trova prima risposta di org diversa dopo ogni blocco
  const responseEvents: Array<{
    requester_org_id: string;
    requester_user_id: string;
    request_message_id: string;
    responder_org_id: string;
    responder_user_id: string;
    response_message_id: string;
    response_seconds: number;
    responder_operator_profile_id: string | null;
  }> = [];
  
  for (const [blockId, blockLast] of blockLastMessages.entries()) {
    // Trova primo messaggio di org diversa dopo questo blocco
    const nextBlock = blocks.find(b => 
      b.block_id > blockId && 
      b.sender_org_id !== blockLast.sender_org_id &&
      b.created_at > blockLast.created_at
    );
    
    if (nextBlock) {
      const responseSeconds = Math.floor(
        (nextBlock.created_at.getTime() - blockLast.created_at.getTime()) / 1000
      );
      
      responseEvents.push({
        requester_org_id: blockLast.sender_org_id,
        requester_user_id: blockLast.sender_user_id,
        request_message_id: blockLast.message_id,
        responder_org_id: nextBlock.sender_org_id,
        responder_user_id: nextBlock.sender_user_id,
        response_message_id: nextBlock.message_id,
        response_seconds: responseSeconds,
        responder_operator_profile_id: nextBlock.operator_profile_id
      });
    }
  }
  
  // STEP 5: Inserisci response_events (evita duplicati)
  let inserted = 0;
  for (const event of responseEvents) {
    // Verifica se esiste già
    const existing = await query(`
      SELECT id FROM response_events 
      WHERE conversation_id = $1 
        AND request_message_id = $2 
        AND response_message_id = $3
    `, [conversationId, event.request_message_id, event.response_message_id]);
    
    if (existing.rows.length === 0) {
      const responseMinutes = event.response_seconds / 60.0;
      
      await query(`
        INSERT INTO response_events (
          id, conversation_id,
          requester_org_id, requester_user_id, request_message_id,
          responder_org_id, responder_user_id, response_message_id,
          response_seconds, response_minutes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        generateId('revent'),
        conversationId,
        event.requester_org_id,
        event.requester_user_id,
        event.request_message_id,
        event.responder_org_id,
        event.responder_user_id,
        event.response_message_id,
        event.response_seconds,
        responseMinutes
      ]);
      
      inserted++;
    }
  }
  
  return inserted;
}

/**
 * Aggrega response_events in response_metrics per Organization e OperatorProfile
 */
export async function aggregateResponseMetrics(windowDays: number = 90): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  
  // Aggrega per Organization
  const orgMetrics = await query(`
    SELECT 
      responder_org_id as entity_id,
      AVG(response_minutes) as avg_response_minutes,
      COUNT(*) as sample_count,
      MAX(created_at) as last_response_at
    FROM response_events
    WHERE created_at >= $1
    GROUP BY responder_org_id
  `, [cutoffDate]);
  
  for (const metric of orgMetrics.rows) {
    await query(`
      INSERT INTO response_metrics (
        id, entity_type, entity_id,
        avg_response_minutes, sample_count, last_response_at,
        calculation_window_days, last_calculated_at
      ) VALUES ($1, 'ORGANIZATION', $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (entity_type, entity_id) 
      DO UPDATE SET
        avg_response_minutes = EXCLUDED.avg_response_minutes,
        sample_count = EXCLUDED.sample_count,
        last_response_at = EXCLUDED.last_response_at,
        calculation_window_days = EXCLUDED.calculation_window_days,
        last_calculated_at = EXCLUDED.last_calculated_at
    `, [
      generateId('rmetric'),
      metric.entity_id,
      metric.avg_response_minutes,
      metric.sample_count,
      metric.last_response_at,
      windowDays
    ]);
  }
  
  // Aggrega per OperatorProfile (solo se responder ha operator_profile)
  const operatorMetrics = await query(`
    SELECT 
      op.id as entity_id,
      AVG(re.response_minutes) as avg_response_minutes,
      COUNT(*) as sample_count,
      MAX(re.created_at) as last_response_at
    FROM response_events re
    JOIN messages m ON m.id = re.response_message_id
    JOIN operator_profiles op ON op.user_id = m.sender_user_id 
      AND op.org_id = re.responder_org_id
      AND op.status = 'ACTIVE'
    WHERE re.created_at >= $1
    GROUP BY op.id
  `, [cutoffDate]);
  
  for (const metric of operatorMetrics.rows) {
    await query(`
      INSERT INTO response_metrics (
        id, entity_type, entity_id,
        avg_response_minutes, sample_count, last_response_at,
        calculation_window_days, last_calculated_at
      ) VALUES ($1, 'OPERATOR_PROFILE', $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (entity_type, entity_id) 
      DO UPDATE SET
        avg_response_minutes = EXCLUDED.avg_response_minutes,
        sample_count = EXCLUDED.sample_count,
        last_response_at = EXCLUDED.last_response_at,
        calculation_window_days = EXCLUDED.calculation_window_days,
        last_calculated_at = EXCLUDED.last_calculated_at
    `, [
      generateId('rmetric'),
      metric.entity_id,
      metric.avg_response_minutes,
      metric.sample_count,
      metric.last_response_at,
      windowDays
    ]);
  }
}

/**
 * Processa tutte le conversation OPEN (ultimi N giorni)
 */
export async function processAllOpenConversations(daysBack: number = 7): Promise<{
  processed: number;
  eventsCreated: number;
}> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  // Trova tutte le conversation OPEN con messaggi recenti
  const conversations = await query(`
    SELECT DISTINCT c.id
    FROM conversations c
    JOIN messages m ON m.conversation_id = c.id
    WHERE c.status = 'OPEN'
      AND m.created_at >= $1
    ORDER BY c.id
  `, [cutoffDate]);
  
  let totalEvents = 0;
  
  for (const conv of conversations.rows) {
    const eventsCreated = await calculateResponseEventsForConversation(conv.id);
    totalEvents += eventsCreated;
  }
  
  // Aggrega le metriche
  await aggregateResponseMetrics();
  
  return {
    processed: conversations.rows.length,
    eventsCreated: totalEvents
  };
}

