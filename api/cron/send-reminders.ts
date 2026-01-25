/**
 * Cron job for automated reminder workflow
 * 
 * Scheduled at 10:30 AM daily (Paris time)
 * 
 * WORKFLOW:
 * - J-30: New → Reminder1_sent (send WhatsApp)
 * - J-15: Reminder1_sent/Pending → Reminder2_sent (send WhatsApp)
 * - J-7: Reminder2_sent/Pending → Reminder3_sent (send WhatsApp)
 * - J-3: Reminder3_sent/Pending → To_be_called (no message, agent must call)
 * 
 * Note: Onhold status is NOT processed (client has responded, waiting for agent)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WHATSAPP_API_TOKEN = process.env.VITE_WHATSAPP_API_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.VITE_WHATSAPP_PHONE_ID || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Workflow configuration
const WORKFLOW_STEPS = [
  {
    name: 'J-30',
    daysBeforeDue: 30,
    sourceStatuses: ['New'],
    targetStatus: 'Reminder1_sent',
    action: 'whatsapp',
    lastReminderSent: 'J30',
  },
  {
    name: 'J-15',
    daysBeforeDue: 15,
    sourceStatuses: ['Reminder1_sent', 'Pending'],
    targetStatus: 'Reminder2_sent',
    action: 'whatsapp',
    lastReminderSent: 'J15',
  },
  {
    name: 'J-7',
    daysBeforeDue: 7,
    sourceStatuses: ['Reminder2_sent', 'Pending'],
    targetStatus: 'Reminder3_sent',
    action: 'whatsapp',
    lastReminderSent: 'J7',
  },
  {
    name: 'J-3',
    daysBeforeDue: 3,
    sourceStatuses: ['Reminder3_sent', 'Pending'],
    targetStatus: 'To_be_called',
    action: 'mark_call',
    lastReminderSent: null, // No message sent
  },
];

interface ReminderWithClient {
  id: string;
  client_id: string;
  due_date: string;
  status: string;
  created_at: string;
  client: {
    id: string;
    phone: string;
    name: string | null;
    vehicle: string | null;
    vehicle_year: number | null;
    last_visit: string | null;
    center_name: string | null;
    center_id: string | null;
  };
}

/**
 * Interface pour les paramètres d'envoi WhatsApp
 */
interface WhatsAppTemplateParams {
  to: string;
  templateName: string;
  datePrecedentVisite: string;
  marque: string;
  modele: string;
  immat: string;
  dateProchVis: string;
  typeCentre: string;
  nomCentre: string;
  shortUrlRendezVous: string;
  numeroAppelCentre: string;
}

/**
 * Send WhatsApp template message with center-specific template
 */
async function sendWhatsAppTemplate(
  params: WhatsAppTemplateParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('Missing WhatsApp credentials');
    return { success: false, error: 'Missing WhatsApp credentials' };
  }

  const cleanedPhone = params.to.replace(/[^\d]/g, '');
  const templateName = params.templateName || 'rappel_visite_technique_vf';
  
  console.log(`📤 Cron: Envoi avec template ${templateName} à ${cleanedPhone}`);
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'fr' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: params.datePrecedentVisite || 'N/A' },
                  { type: 'text', text: params.marque || 'N/A' },
                  { type: 'text', text: params.modele || 'N/A' },
                  { type: 'text', text: params.immat || 'N/A' },
                  { type: 'text', text: params.dateProchVis || 'N/A' },
                  { type: 'text', text: params.typeCentre || 'N/A' },
                  { type: 'text', text: params.nomCentre || 'N/A' },
                ],
              },
              // Boutons (seront ignorés si le template a des boutons fixes)
              {
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: params.shortUrlRendezVous || '' }],
              },
              {
                type: 'button',
                sub_type: 'phone_number',
                index: 1,
                parameters: [{ type: 'text', text: params.numeroAppelCentre?.replace(/[^\d]/g, '') || '' }],
              },
            ],
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'API Error' };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create notification for agents
 */
async function createNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'action_required' | 'success',
  link?: string
) {
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['admin', 'superadmin', 'agent']);

  if (admins && admins.length > 0) {
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message,
      type,
      link,
    }));

    await supabase.from('notifications').insert(notifications);
    console.log(`📢 Created ${notifications.length} notifications`);
  }
}

/**
 * Calculate days until due date
 */
function getDaysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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
  // Le reste est le modèle
  const modele = parts.slice(1).join(' ');
  
  return { marque, modele };
}

/**
 * Format date for message (legacy function, kept for compatibility)
 */
function formatDate(dateStr: string): string {
  return formatDateForMessage(dateStr);
}

/**
 * Process reminders for a specific workflow step
 */
async function processWorkflowStep(
  step: typeof WORKFLOW_STEPS[0],
  results: { whatsapp_sent: number; whatsapp_failed: number; calls_required: number }
) {
  console.log(`\n📋 Processing ${step.name} (${step.action})...`);

  // Find reminders that match this step's criteria
  // Exclude reminders created in the last 10 minutes to avoid processing during import
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select(`
      id,
      client_id,
      due_date,
      status,
      created_at,
      client:clients(id, phone, name, vehicle, vehicle_year, last_visit, center_name, center_id)
    `)
    .in('status', step.sourceStatuses)
    .lt('created_at', tenMinutesAgo); // Only process reminders older than 10 minutes

  if (error) {
    console.error(`Error fetching reminders for ${step.name}:`, error);
    return;
  }

  if (!reminders || reminders.length === 0) {
    console.log(`  No reminders found for ${step.name}`);
    return;
  }

  // Filter by days until due
  const eligibleReminders = reminders.filter(r => {
    const daysUntil = getDaysUntilDue(r.due_date);
    // For J-30, process if daysUntil <= 30
    // For J-15, process if daysUntil <= 15
    // etc.
    return daysUntil <= step.daysBeforeDue;
  });

  console.log(`  Found ${eligibleReminders.length} eligible reminders`);

  for (const reminder of eligibleReminders) {
    // Handle joined client data
    const clientData = Array.isArray(reminder.client) 
      ? reminder.client[0] 
      : reminder.client;

    if (!clientData?.phone) {
      console.log(`  ⚠️ Skipping reminder ${reminder.id} - no phone number`);
      continue;
    }

    if (step.action === 'whatsapp') {
      // Récupérer les informations du centre technique avec le template_name
      let techCenter: { name: string; phone: string | null; short_url: string | null; network: string | null; template_name: string | null } | null = null;
      
      if (clientData.center_name || clientData.center_id) {
        const centerQuery = clientData.center_id 
          ? supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('id', clientData.center_id).single()
          : supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('name', clientData.center_name).single();
        
        const { data: centerData, error: centerError } = await centerQuery;
        
        if (!centerError && centerData) {
          techCenter = centerData;
        }
      }

      // Valeurs par défaut si le centre n'est pas trouvé
      const nomCentre = techCenter?.name || clientData.center_name || 'Notre centre';
      const typeCentre = techCenter?.network || 'AUTOSUR';
      const shortUrlRendezVous = techCenter?.short_url || '';
      const numeroAppelCentre = techCenter?.phone || '';
      const templateName = techCenter?.template_name || 'rappel_visite_technique_vf';

      // Préparer les variables du template
      const datePrecedentVisite = formatDateForMessage(clientData.last_visit);
      const { marque, modele } = parseVehicle(clientData.vehicle);
      const immat = ''; // TODO: Ajouter le champ immatriculation si nécessaire
      const dateProchVis = formatDateForMessage(reminder.due_date);

      // Send WhatsApp message avec le template du centre
      const result = await sendWhatsAppTemplate({
        to: clientData.phone,
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

      if (result.success) {
        // Update reminder status
        await supabase
          .from('reminders')
          .update({
            status: step.targetStatus,
            last_reminder_sent: step.lastReminderSent,
            last_reminder_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        // Log the action
        await supabase.from('reminder_logs').insert({
          reminder_id: reminder.id,
          action_type: 'whatsapp',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        console.log(`  ✅ ${step.name} sent to ${clientData.phone}`);
        results.whatsapp_sent++;
      } else {
        // Log failure but don't change status
        await supabase.from('reminder_logs').insert({
          reminder_id: reminder.id,
          action_type: 'whatsapp',
          status: 'failed',
          error_message: result.error,
        });

        console.log(`  ❌ ${step.name} failed for ${clientData.phone}: ${result.error}`);
        results.whatsapp_failed++;
      }
    } else if (step.action === 'mark_call') {
      // Update status to To_be_called
      await supabase
        .from('reminders')
        .update({
          status: step.targetStatus,
        })
        .eq('id', reminder.id);

      // Log the action
      await supabase.from('reminder_logs').insert({
        reminder_id: reminder.id,
        action_type: 'call',
        status: 'pending',
      });

      // Create notification for agents
      const formattedDueDate = formatDateForMessage(reminder.due_date);
      await createNotification(
        '📞 Appel requis',
        `${clientData.name || clientData.phone} - Échéance: ${formattedDueDate}`,
        'action_required',
        `/clients/${reminder.client_id}`
      );

      console.log(`  📞 ${clientData.phone} marked for call`);
      results.calls_required++;
    }

    // Small delay between sends to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET for testing and POST for cron
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔄 Starting reminder workflow cron job...');
  console.log(`⏰ Time: ${new Date().toISOString()}`);

  try {
    const results = {
      whatsapp_sent: 0,
      whatsapp_failed: 0,
      calls_required: 0,
    };

    // Process each workflow step in order
    for (const step of WORKFLOW_STEPS) {
      await processWorkflowStep(step, results);
    }

    console.log('\n✅ Cron job completed:', results);

    // Create summary notification if there were actions
    const totalActions = results.whatsapp_sent + results.calls_required;
    if (totalActions > 0) {
      await createNotification(
        '📊 Rapport des rappels automatiques',
        `${results.whatsapp_sent} WhatsApp envoyés, ${results.calls_required} clients à appeler`,
        results.calls_required > 0 ? 'action_required' : 'info',
        '/todo'
      );
    }

    return res.status(200).json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Cron job error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
