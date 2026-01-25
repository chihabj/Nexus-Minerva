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
 * Formate une date pour l'affichage dans le message WhatsApp (format DD/MM/YYYY)
 */
function formatDateForMessage(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr || 'N/A';
  }
}

/**
 * Parse le véhicule pour extraire la marque et le modèle
 * Format attendu: "Marque Modèle" ou "Marque Modèle Année"
 */
function parseVehicle(vehicle: string | null): { marque: string; modele: string } {
  if (!vehicle) return { marque: 'N/A', modele: 'N/A' };
  
  const parts = vehicle.trim().split(/\s+/);
  if (parts.length === 0) return { marque: 'N/A', modele: 'N/A' };
  if (parts.length === 1) return { marque: parts[0], modele: 'N/A' };
  
  // La première partie est généralement la marque
  const marque = parts[0];
  // Le reste est le modèle (peut inclure l'année, mais on prend tout sauf la dernière partie si c'est un nombre)
  const modele = parts.slice(1).join(' ');
  
  return { marque, modele };
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
          marque,
          modele,
          immatriculation,
          last_visit,
          center_name,
          center_id
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

    // 2. Récupérer les informations du centre technique
    let techCenter: { name: string; phone: string | null; short_url: string | null; network: string | null; template_name: string | null } | null = null;
    
    if (client.center_name || client.center_id) {
      const centerQuery = client.center_id 
        ? supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('id', client.center_id).single()
        : supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('name', client.center_name).single();
      
      const { data: centerData, error: centerError } = await centerQuery;
      
      if (!centerError && centerData) {
        techCenter = centerData;
      }
    }

    // Valeurs par défaut si le centre n'est pas trouvé
    const nomCentre = techCenter?.name || client.center_name || 'Notre centre';
    const typeCentre = techCenter?.network || 'AUTOSUR'; // Valeur par défaut
    const shortUrlRendezVous = techCenter?.short_url || '';
    const numeroAppelCentre = techCenter?.phone || '';
    const templateName = techCenter?.template_name || undefined; // Utilise le template du centre ou le défaut

    // 3. Préparer les variables du template
    const datePrecedentVisite = formatDateForMessage(client.last_visit);
    // Utiliser les champs séparés ou fallback sur parseVehicle
    const marque = client.marque || parseVehicle(client.vehicle).marque;
    const modele = client.modele || parseVehicle(client.vehicle).modele;
    const immat = client.immatriculation || '';
    const dateProchVis = reminder.due_date 
      ? formatDateForMessage(reminder.due_date)
      : (() => {
          if (!client.last_visit) return 'N/A';
          try {
            const date = new Date(client.last_visit);
            date.setFullYear(date.getFullYear() + 2);
            return formatDateForMessage(date.toISOString());
          } catch {
            return 'N/A';
          }
        })();

    console.log(`📤 Envoi à ${cleanedPhone}:`, {
      templateName: templateName || 'rappel_visite_technique_vf (défaut)',
      datePrecedentVisite,
      marque,
      modele,
      immat,
      dateProchVis,
      typeCentre,
      nomCentre,
    });

    // 4. Envoyer le message WhatsApp avec le template du centre (ou template par défaut)
    const whatsappResult: WhatsAppResponse = await sendRappelVisiteTechnique({
      to: cleanedPhone,
      templateName,
      datePrecedentVisite,
      marque,
      modele,
      immat,
      dateProchVis,
      typeCentre,
      nomCentre,
      shortUrlRendezVous,
      numeroAppelCentre,
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
        content: `Relance WhatsApp envoyée (rappel_visite_technique)\n• Nom: ${client.name || 'Client'}\n• Véhicule: ${marque} ${modele}\n• Date prochaine visite: ${dateProchVis}`,
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
