/**
 * Actions pour l'envoi de relances WhatsApp
 */

import { sendHelloWorldTemplate, cleanPhoneNumber, WhatsAppResponse } from '../services/whatsapp';
import { supabase } from '../services/supabaseClient';

export interface SendReminderResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Envoie une relance WhatsApp et met à jour le statut dans Supabase
 * 
 * @param reminderId - ID du reminder dans Supabase
 * @param clientPhone - Numéro de téléphone du client
 * @returns Résultat de l'envoi
 */
export async function sendReminderAction(
  reminderId: string,
  clientPhone: string
): Promise<SendReminderResult> {
  
  // Validation des paramètres
  if (!reminderId) {
    return {
      success: false,
      error: 'ID de relance manquant',
    };
  }

  if (!clientPhone) {
    return {
      success: false,
      error: 'Numéro de téléphone manquant',
    };
  }

  const cleanedPhone = cleanPhoneNumber(clientPhone);
  if (!cleanedPhone || cleanedPhone.length < 10) {
    return {
      success: false,
      error: 'Numéro de téléphone invalide',
    };
  }

  console.log(`📱 Envoi de relance ${reminderId} vers ${cleanedPhone}...`);

  try {
    // 1. Envoyer le message WhatsApp
    const whatsappResult: WhatsAppResponse = await sendHelloWorldTemplate(cleanedPhone);

    if (!whatsappResult.success) {
      console.error('❌ Échec envoi WhatsApp:', whatsappResult.error);
      
      // Mettre à jour le statut en 'Failed' dans Supabase
      await supabase
        .from('reminders')
        .update({
          status: 'Failed',
          message: whatsappResult.error,
        })
        .eq('id', reminderId);

      return {
        success: false,
        error: whatsappResult.error,
      };
    }

    // 2. Mettre à jour le statut en 'Sent' dans Supabase
    const { error: updateError } = await supabase
      .from('reminders')
      .update({
        status: 'Sent',
        sent_at: new Date().toISOString(),
        message: `WhatsApp envoyé - ID: ${whatsappResult.messageId}`,
      })
      .eq('id', reminderId);

    if (updateError) {
      console.error('⚠️ WhatsApp envoyé mais erreur DB:', updateError);
      return {
        success: true,
        messageId: whatsappResult.messageId,
        error: 'Message envoyé mais erreur lors de la mise à jour du statut',
      };
    }

    // 3. Ajouter une note système dans client_notes
    // D'abord, récupérer le client_id du reminder
    const { data: reminder } = await supabase
      .from('reminders')
      .select('client_id')
      .eq('id', reminderId)
      .single();

    if (reminder?.client_id) {
      await supabase
        .from('client_notes')
        .insert({
          client_id: reminder.client_id,
          content: `Relance WhatsApp envoyée (template: hello_world)`,
          author: 'Système',
          note_type: 'system',
        });
    }

    console.log('✅ Relance envoyée avec succès:', whatsappResult.messageId);

    return {
      success: true,
      messageId: whatsappResult.messageId,
    };

  } catch (error) {
    console.error('❌ Exception lors de l\'envoi:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inattendue',
    };
  }
}

/**
 * Envoie des relances en masse (batch)
 * 
 * @param reminders - Liste des {reminderId, clientPhone}
 * @returns Résumé des envois
 */
export async function sendBatchReminders(
  reminders: Array<{ reminderId: string; clientPhone: string }>
): Promise<{
  total: number;
  sent: number;
  failed: number;
  results: SendReminderResult[];
}> {
  const results: SendReminderResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const { reminderId, clientPhone } of reminders) {
    const result = await sendReminderAction(reminderId, clientPhone);
    results.push(result);
    
    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Pause entre les envois pour respecter les rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return {
    total: reminders.length,
    sent,
    failed,
    results,
  };
}
