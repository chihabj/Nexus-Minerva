/**
 * Actions pour l'envoi de relances WhatsApp
 */

import { sendRappelVisiteTechnique, cleanPhoneNumber, WhatsAppResponse } from '../services/whatsapp';
import { supabase } from '../services/supabaseClient';

export interface SendReminderResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Formate une date pour l'affichage dans le message WhatsApp
 */
function formatDateForMessage(dateStr: string | null): string {
  if (!dateStr) return 'Bientôt';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calcule la date d'échéance (last_visit + 2 ans)
 */
function calculateDueDate(lastVisit: string | null): string {
  if (!lastVisit) return 'Bientôt';
  try {
    const date = new Date(lastVisit);
    date.setFullYear(date.getFullYear() + 2);
    return formatDateForMessage(date.toISOString());
  } catch {
    return 'Bientôt';
  }
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

  console.log(`📱 Préparation de la relance ${reminderId}...`);

  try {
    // 1. Récupérer les infos du reminder et du client depuis Supabase
    const { data: reminder, error: fetchError } = await supabase
      .from('reminders')
      .select(`
        *,
        clients (
          id,
          name,
          phone,
          vehicle,
          vehicle_year,
          last_visit,
          center_name
        )
      `)
      .eq('id', reminderId)
      .single();

    if (fetchError || !reminder) {
      console.error('❌ Erreur récupération reminder:', fetchError);
      return {
        success: false,
        error: 'Relance introuvable',
      };
    }

    const client = reminder.clients;
    if (!client) {
      return {
        success: false,
        error: 'Client introuvable pour cette relance',
      };
    }

    // 2. Préparer les variables du template
    const clientName = client.name || 'Client';
    const vehicleName = client.vehicle 
      ? `${client.vehicle}${client.vehicle_year ? ` (${client.vehicle_year})` : ''}`
      : 'votre véhicule';
    const dateEcheance = reminder.due_date 
      ? formatDateForMessage(reminder.due_date)
      : calculateDueDate(client.last_visit);

    console.log(`📤 Envoi à ${cleanedPhone}:`, {
      clientName,
      vehicleName,
      dateEcheance,
    });

    // 3. Envoyer le message WhatsApp avec le template rappel_visite_technique
    const whatsappResult: WhatsAppResponse = await sendRappelVisiteTechnique({
      to: cleanedPhone,
      clientName,
      vehicleName,
      dateEcheance,
    });

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

    // 4. Mettre à jour le statut en 'Sent' dans Supabase
    const { error: updateError } = await supabase
      .from('reminders')
      .update({
        status: 'Sent',
        sent_at: new Date().toISOString(),
        message: `WhatsApp envoyé - Template: rappel_visite_technique - ID: ${whatsappResult.messageId}`,
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

    // 5. Ajouter une note système dans client_notes
    await supabase
      .from('client_notes')
      .insert({
        client_id: client.id,
        content: `Relance WhatsApp envoyée (rappel_visite_technique)\n• Nom: ${clientName}\n• Véhicule: ${vehicleName}\n• Échéance: ${dateEcheance}`,
        author: 'Système',
        note_type: 'system',
      });

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

    // Pause entre les envois pour respecter les rate limits (1 par seconde max)
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return {
    total: reminders.length,
    sent,
    failed,
    results,
  };
}
