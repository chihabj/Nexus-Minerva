/**
 * ONE-TIME catch-up cron for reminders blocked by the phone_number bug
 * 
 * Scheduled: Feb 26 2026, 9:00 UTC (10:00 Paris)
 * 
 * The bug: send-reminders.ts used sub_type 'phone_number' instead of 'VOICE_CALL',
 * causing ALL cron WhatsApp sends to fail silently. Reminders stayed stuck in
 * Reminder1_sent, Reminder2_sent, Reminder3_sent, or Pending without advancing.
 * 
 * This cron:
 * 1. Finds all stuck reminders that should have advanced
 * 2. Calculates the CORRECT status each should be at today
 * 3. For overdue or J<=3: skips WhatsApp, marks To_be_called directly
 * 4. For others: sends ONE WhatsApp, advances to correct status
 * 5. After this runs, the normal 10:30 cron won't re-process them
 * 
 * REMOVE THIS CRON FROM vercel.json AFTER IT RUNS SUCCESSFULLY
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WHATSAPP_API_TOKEN = process.env.VITE_WHATSAPP_API_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.VITE_WHATSAPP_PHONE_ID || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DELAY_BETWEEN_MESSAGES = 1500;

// Status hierarchy (higher index = further in workflow)
const STATUS_ORDER: Record<string, number> = {
  New: 0,
  Pending: 1,
  Reminder1_sent: 2,
  Reminder2_sent: 3,
  Reminder3_sent: 4,
  To_be_called: 5,
};

interface StuckReminder {
  id: string;
  client_id: string;
  due_date: string;
  status: string;
  created_at: string;
  last_reminder_sent: string | null;
  client: {
    id: string;
    phone: string;
    name: string | null;
    center_name: string | null;
    center_id: string | null;
  };
}

interface WhatsAppTemplateParams {
  to: string;
  templateName: string;
  nomCentre: string;
  dateProchVis: string;
  shortUrlRendezVous: string;
  numeroAppelCentre: string;
}

/**
 * Determine the correct target status based on days until due
 */
function getTargetStatus(daysUntil: number): string {
  if (daysUntil <= 3) return 'To_be_called';
  if (daysUntil <= 7) return 'Reminder3_sent';
  if (daysUntil <= 15) return 'Reminder2_sent';
  if (daysUntil <= 30) return 'Reminder1_sent';
  return 'New'; // not eligible yet
}

/**
 * Check if a reminder needs catching up (target is ahead of current)
 */
function needsCatchUp(currentStatus: string, targetStatus: string): boolean {
  const currentOrder = STATUS_ORDER[currentStatus] ?? -1;
  const targetOrder = STATUS_ORDER[targetStatus] ?? -1;
  return targetOrder > currentOrder;
}

function getDaysUntilDue(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateForMessage(dateStr: string): string {
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

async function sendWhatsAppTemplate(
  params: WhatsAppTemplateParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    return { success: false, error: 'Missing WhatsApp credentials' };
  }

  const cleanedPhone = params.to.replace(/[^\d]/g, '');
  const templateName = params.templateName || 'rappel_visite_technique_vf';

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
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: params.nomCentre || 'N/A' },
                  { type: 'text', text: params.dateProchVis || 'N/A' },
                ],
              },
              {
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [{ type: 'text', text: params.shortUrlRendezVous || '' }],
              },
              {
                type: 'button',
                sub_type: 'VOICE_CALL',
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
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔧 === CATCH-UP CRON START ===');
  console.log(`⏰ Time: ${new Date().toISOString()}`);

  const results = {
    total_stuck: 0,
    whatsapp_sent: 0,
    whatsapp_failed: 0,
    marked_to_be_called: 0,
    skipped: 0,
    details: [] as { phone: string; name: string | null; from: string; to: string; action: string }[],
  };

  try {
    // Find ALL reminders stuck in intermediate statuses
    const { data: stuckReminders, error } = await supabase
      .from('reminders')
      .select(`
        id, client_id, due_date, status, created_at, last_reminder_sent,
        client:clients(id, phone, name, center_name, center_id)
      `)
      .in('status', ['New', 'Pending', 'Reminder1_sent', 'Reminder2_sent', 'Reminder3_sent'])
      .order('due_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching stuck reminders:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!stuckReminders || stuckReminders.length === 0) {
      console.log('✅ No stuck reminders found');
      return res.status(200).json({ success: true, message: 'No stuck reminders', results });
    }

    console.log(`📋 Found ${stuckReminders.length} reminders in intermediate statuses`);

    // Filter to only those that actually need catching up
    const remindersToProcess: { reminder: StuckReminder; targetStatus: string; daysUntil: number }[] = [];

    for (const r of stuckReminders) {
      const clientData = Array.isArray(r.client) ? r.client[0] : r.client;
      if (!clientData?.phone) continue;

      const daysUntil = getDaysUntilDue(r.due_date);
      const targetStatus = getTargetStatus(daysUntil);

      if (needsCatchUp(r.status, targetStatus)) {
        remindersToProcess.push({
          reminder: { ...r, client: clientData } as StuckReminder,
          targetStatus,
          daysUntil,
        });
      }
    }

    results.total_stuck = remindersToProcess.length;
    console.log(`🎯 ${remindersToProcess.length} reminders need catching up`);

    if (remindersToProcess.length === 0) {
      return res.status(200).json({ success: true, message: 'All reminders already at correct status', results });
    }

    // Process each stuck reminder
    for (let i = 0; i < remindersToProcess.length; i++) {
      const { reminder, targetStatus, daysUntil } = remindersToProcess[i];
      const client = reminder.client;

      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES));
      }

      const detail = {
        phone: client.phone,
        name: client.name,
        from: reminder.status,
        to: targetStatus,
        action: '',
      };

      // OVERDUE or J-3: skip WhatsApp, go directly to To_be_called
      if (targetStatus === 'To_be_called') {
        console.log(`📞 ${client.phone} (${client.name}) - overdue/J-3 (J${daysUntil}) → To_be_called (no WhatsApp)`);

        await supabase
          .from('reminders')
          .update({
            status: 'To_be_called',
            last_reminder_sent: 'catch_up',
            last_reminder_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        await supabase.from('reminder_logs').insert({
          reminder_id: reminder.id,
          action_type: 'catch_up',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        detail.action = `Marqué To_be_called (J${daysUntil}, pas de WhatsApp)`;
        results.marked_to_be_called++;
        results.details.push(detail);
        continue;
      }

      // Still in time: send ONE WhatsApp and advance to correct status
      let techCenter: { name: string; phone: string | null; short_url: string | null; network: string | null; template_name: string | null } | null = null;

      if (client.center_name || client.center_id) {
        const centerQuery = client.center_id
          ? supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('id', client.center_id).single()
          : supabase.from('tech_centers').select('name, phone, short_url, network, template_name').eq('name', client.center_name!).single();

        const { data: centerData } = await centerQuery;
        if (centerData) techCenter = centerData;
      }

      const nomCentre = techCenter?.name || client.center_name || 'Notre centre';
      const typeCentre = techCenter?.network || 'AUTOSUR';
      const centreComplet = typeCentre ? `${nomCentre} - ${typeCentre}` : nomCentre;
      const dateProchVis = formatDateForMessage(reminder.due_date);
      const templateName = techCenter?.template_name || 'rappel_visite_technique_vf';

      console.log(`📤 ${client.phone} (${client.name}) - J${daysUntil} | ${reminder.status} → ${targetStatus}`);

      const whatsappResult = await sendWhatsAppTemplate({
        to: client.phone,
        templateName,
        nomCentre: centreComplet,
        dateProchVis,
        shortUrlRendezVous: techCenter?.short_url || '',
        numeroAppelCentre: techCenter?.phone || '',
      });

      if (whatsappResult.success) {
        // Advance to correct status
        const lastReminderMap: Record<string, string> = {
          Reminder1_sent: 'J30_catchup',
          Reminder2_sent: 'J15_catchup',
          Reminder3_sent: 'J7_catchup',
        };

        await supabase
          .from('reminders')
          .update({
            status: targetStatus,
            last_reminder_sent: lastReminderMap[targetStatus] || 'catch_up',
            last_reminder_at: new Date().toISOString(),
          })
          .eq('id', reminder.id);

        await supabase.from('reminder_logs').insert({
          reminder_id: reminder.id,
          action_type: 'whatsapp',
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        // Create/update conversation and message record
        try {
          const sentAt = new Date().toISOString();
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('client_id', reminder.client_id)
            .single();

          let conversationId: string | undefined;

          if (existingConv) {
            conversationId = existingConv.id;
            await supabase
              .from('conversations')
              .update({
                last_message: `[Relance rattrapage] Template: ${templateName}`,
                last_message_at: sentAt,
                status: 'open',
              })
              .eq('id', conversationId);
          } else {
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                client_id: reminder.client_id,
                client_phone: client.phone,
                client_name: client.name,
                last_message: `[Relance rattrapage] Template: ${templateName}`,
                last_message_at: sentAt,
                unread_count: 0,
                status: 'open',
              })
              .select('id')
              .single();
            if (newConv) conversationId = newConv.id;
          }

          if (conversationId) {
            const messageContent = `Madame, Monsieur,\n\nNous avons eu le plaisir de contrôler votre véhicule dans notre centre ${centreComplet}.\n\nLa validité de ce contrôle technique arrivant bientôt à échéance, le prochain devra s'effectuer avant le : ${dateProchVis}.\n\nNous vous invitons à prendre rendez-vous en ligne ou par téléphone.`;

            await supabase.from('messages').insert({
              conversation_id: conversationId,
              wa_message_id: whatsappResult.messageId || null,
              from_phone: '33767668396',
              to_phone: client.phone,
              direction: 'outbound',
              message_type: 'template',
              content: messageContent,
              template_name: templateName,
              status: 'sent',
            });
          }
        } catch (convError) {
          console.error('❌ Error creating conversation/message:', convError);
        }

        detail.action = `WhatsApp envoyé + avancé à ${targetStatus}`;
        results.whatsapp_sent++;
      } else {
        await supabase.from('reminder_logs').insert({
          reminder_id: reminder.id,
          action_type: 'whatsapp',
          status: 'failed',
          error_message: whatsappResult.error,
        });

        detail.action = `ÉCHEC WhatsApp: ${whatsappResult.error}`;
        results.whatsapp_failed++;
      }

      results.details.push(detail);
    }

    // Summary notification
    const parts: string[] = [];
    if (results.whatsapp_sent > 0) parts.push(`${results.whatsapp_sent} WhatsApp envoyés`);
    if (results.marked_to_be_called > 0) parts.push(`${results.marked_to_be_called} marqués À appeler (en retard)`);
    if (results.whatsapp_failed > 0) parts.push(`⚠️ ${results.whatsapp_failed} échecs`);

    await createNotification(
      '🔧 Rattrapage des relances bloquées',
      `${results.total_stuck} dossiers traités: ${parts.join(', ')}`,
      results.whatsapp_failed > 0 ? 'warning' : 'success',
      '/todo'
    );

    console.log('\n🔧 === CATCH-UP RESULTS ===');
    console.log(JSON.stringify(results, null, 2));

    return res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('❌ Catch-up cron error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
