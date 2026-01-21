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
  client: {
    id: string;
    phone: string;
    name: string | null;
    vehicle: string | null;
  };
}

/**
 * Send WhatsApp template message using rappel_visite_technique_vf
 */
async function sendWhatsAppTemplate(
  to: string,
  clientName: string,
  vehicleName: string,
  dueDate: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('Missing WhatsApp credentials');
    return { success: false, error: 'Missing WhatsApp credentials' };
  }

  const cleanedPhone = to.replace(/[^\d]/g, '');
  
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
            name: 'rappel_visite_technique_vf',
            language: { code: 'fr' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: clientName || 'Client' },
                  { type: 'text', text: vehicleName || 'Votre véhicule' },
                  { type: 'text', text: dueDate },
                ],
              },
              {
                type: 'button',
                sub_type: 'quick_reply',
                index: 0,
                parameters: [{ type: 'payload', payload: 'TAKE_APPOINTMENT' }],
              },
              {
                type: 'button',
                sub_type: 'quick_reply',
                index: 1,
                parameters: [{ type: 'payload', payload: 'CALLBACK_REQUEST' }],
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
 * Format date for message
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
  const { data: reminders, error } = await supabase
    .from('reminders')
    .select(`
      id,
      client_id,
      due_date,
      status,
      client:clients(id, phone, name, vehicle)
    `)
    .in('status', step.sourceStatuses);

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

    const formattedDueDate = formatDate(reminder.due_date);

    if (step.action === 'whatsapp') {
      // Send WhatsApp message
      const result = await sendWhatsAppTemplate(
        clientData.phone,
        clientData.name || 'Client',
        clientData.vehicle || 'Votre véhicule',
        formattedDueDate
      );

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
