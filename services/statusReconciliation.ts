/**
 * Service de réconciliation des statuts WhatsApp
 * Permet de récupérer et appliquer les statuts qui sont arrivés avant que le message soit créé (race condition)
 */

import { supabase } from './supabaseClient';

/**
 * Réconcilie les statuts WhatsApp pour un message nouvellement créé
 * Cherche dans whatsapp_status_log les statuts non traités pour ce wa_message_id
 * et applique le plus récent au message
 * 
 * @param waMessageId - L'ID du message WhatsApp (retourné par Meta)
 * @param messageId - L'ID du message en base de données (UUID)
 * @returns Le statut appliqué ou null si aucun statut en attente
 */
export async function reconcileMessageStatus(
  waMessageId: string,
  messageId: string
): Promise<string | null> {
  if (!waMessageId) {
    console.log('⚠️ No wa_message_id provided, skipping reconciliation');
    return null;
  }

  try {
    // 1. Chercher les statuts non traités pour ce wa_message_id
    const { data: pendingStatuses, error: fetchError } = await supabase
      .from('whatsapp_status_log')
      .select('*')
      .eq('wa_message_id', waMessageId)
      .eq('processed', false)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching pending statuses:', fetchError);
      return null;
    }

    if (!pendingStatuses || pendingStatuses.length === 0) {
      console.log(`📋 No pending status updates for ${waMessageId}`);
      return null;
    }

    console.log(`📋 Found ${pendingStatuses.length} pending status(es) for ${waMessageId}`);

    // 2. Trouver le statut le plus avancé (read > delivered > sent > failed)
    const statusPriority: Record<string, number> = {
      'failed': 0,
      'sent': 1,
      'delivered': 2,
      'read': 3,
    };

    const latestStatus = pendingStatuses.reduce((best, current) => {
      const currentPriority = statusPriority[current.status] ?? -1;
      const bestPriority = statusPriority[best.status] ?? -1;
      return currentPriority > bestPriority ? current : best;
    });

    console.log(`📋 Applying status: ${latestStatus.status} to message ${messageId}`);

    // 3. Mettre à jour le message avec le statut
    const updateData: any = { status: latestStatus.status };
    
    // Si failed, ajouter le message d'erreur
    if (latestStatus.status === 'failed' && latestStatus.errors) {
      const errors = latestStatus.errors as Array<{ code: number; title: string }>;
      updateData.error_message = errors.map(e => `[${e.code}] ${e.title}`).join('; ');
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);

    if (updateError) {
      console.error('❌ Error updating message status:', updateError);
      return null;
    }

    // 4. Marquer tous les statuts comme traités
    const statusIds = pendingStatuses.map(s => s.id);
    await supabase
      .from('whatsapp_status_log')
      .update({ 
        processed: true, 
        processed_at: new Date().toISOString(),
        message_id: messageId,
      })
      .in('id', statusIds);

    console.log(`✅ Reconciled ${pendingStatuses.length} status(es) for message ${messageId} -> ${latestStatus.status}`);

    return latestStatus.status;

  } catch (error) {
    console.error('❌ Error in reconcileMessageStatus:', error);
    return null;
  }
}

/**
 * Réconcilie tous les statuts en attente (pour cron job)
 * Cherche les logs non traités et essaie de les matcher avec des messages existants
 * 
 * @param maxAgeMinutes - Ne traiter que les logs plus vieux que X minutes (évite les race conditions)
 * @returns Nombre de statuts réconciliés
 */
export async function reconcileAllPendingStatuses(maxAgeMinutes: number = 5): Promise<number> {
  try {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

    // 1. Récupérer les statuts non traités plus vieux que le cutoff
    const { data: pendingLogs, error: fetchError } = await supabase
      .from('whatsapp_status_log')
      .select('wa_message_id')
      .eq('processed', false)
      .lt('created_at', cutoffTime)
      .order('wa_message_id');

    if (fetchError || !pendingLogs) {
      console.error('❌ Error fetching pending logs:', fetchError);
      return 0;
    }

    // Grouper par wa_message_id unique
    const uniqueWaIds = [...new Set(pendingLogs.map(l => l.wa_message_id))];
    console.log(`📋 Found ${uniqueWaIds.length} unique wa_message_ids with pending statuses`);

    let reconciled = 0;

    for (const waMessageId of uniqueWaIds) {
      // Chercher le message correspondant
      const { data: message } = await supabase
        .from('messages')
        .select('id')
        .eq('wa_message_id', waMessageId)
        .single();

      if (message) {
        const result = await reconcileMessageStatus(waMessageId, message.id);
        if (result) reconciled++;
      } else {
        console.log(`⚠️ No message found for wa_message_id: ${waMessageId}`);
      }
    }

    console.log(`✅ Reconciliation complete: ${reconciled}/${uniqueWaIds.length} statuses applied`);
    return reconciled;

  } catch (error) {
    console.error('❌ Error in reconcileAllPendingStatuses:', error);
    return 0;
  }
}
