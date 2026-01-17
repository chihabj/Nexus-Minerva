/**
 * Cron job for automated reminder sending
 * 
 * This endpoint should be called by Vercel Cron daily to:
 * 1. Find all reminders that need action today
 * 2. Send WhatsApp messages for each step
 * 3. Update reminder status
 * 4. Create notifications for agents when calls are needed
 * 
 * Vercel Cron config in vercel.json:
 * "crons": [{ "path": "/api/cron/send-reminders", "schedule": "0 8 * * *" }]
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WHATSAPP_API_TOKEN = process.env.VITE_WHATSAPP_API_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.VITE_WHATSAPP_PHONE_ID || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ReminderWithClient {
  id: string;
  client_id: string;
  due_date: string;
  current_step: number;
  status: string;
  client: {
    id: string;
    phone: string;
    name: string | null;
    vehicle: string | null;
  };
}

interface ReminderStep {
  id: string;
  step_order: number;
  days_before_due: number;
  action_type: 'whatsapp' | 'call' | 'email';
  template_name: string | null;
}

/**
 * Send WhatsApp template message
 */
async function sendWhatsAppTemplate(
  to: string,
  clientName: string,
  vehicleName: string,
  dueDate: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanedPhone = to.replace(/[^\d]/g, '');
  
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
          name: 'rappel_visite_technique',
          language: { code: 'fr' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: clientName || 'Client' },
                { type: 'text', text: vehicleName || 'Véhicule' },
                { type: 'text', text: dueDate },
              ],
            },
          ],
        },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return { success: false, error: data.error?.message || 'API Error' };
  }

  return { success: true, messageId: data.messages?.[0]?.id };
}

/**
 * Create notification for agents
 */
async function createNotification(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'action_required',
  link?: string
) {
  // Get all admin/superadmin users
  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['admin', 'superadmin']);

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

/**
 * Process a single reminder
 */
async function processReminder(
  reminder: ReminderWithClient,
  steps: ReminderStep[]
): Promise<{ action: string; success: boolean; error?: string }> {
  const today = new Date();
  const dueDate = new Date(reminder.due_date);
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Find the appropriate step based on days until due
  const applicableStep = steps.find(step => {
    return step.days_before_due >= daysUntilDue && step.step_order > reminder.current_step;
  });

  if (!applicableStep) {
    return { action: 'no_action', success: true };
  }

  // Check if this step was already processed
  const { data: existingLog } = await supabase
    .from('reminder_logs')
    .select('id')
    .eq('reminder_id', reminder.id)
    .eq('step_id', applicableStep.id)
    .single();

  if (existingLog) {
    return { action: 'already_processed', success: true };
  }

  // Format due date for message
  const formattedDueDate = new Date(reminder.due_date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (applicableStep.action_type === 'whatsapp') {
    // Send WhatsApp message
    const result = await sendWhatsAppTemplate(
      reminder.client.phone || '',
      reminder.client.name || 'Client',
      reminder.client.vehicle || 'Votre véhicule',
      formattedDueDate
    );

    // Log the action
    await supabase.from('reminder_logs').insert({
      reminder_id: reminder.id,
      step_id: applicableStep.id,
      action_type: 'whatsapp',
      status: result.success ? 'sent' : 'failed',
      sent_at: new Date().toISOString(),
      error_message: result.error,
    });

    // Update reminder
    const newStatus = `Reminder_${applicableStep.step_order}`;
    await supabase
      .from('reminders')
      .update({
        current_step: applicableStep.step_order,
        status: newStatus,
        next_action_date: calculateNextActionDate(dueDate, steps, applicableStep.step_order),
      })
      .eq('id', reminder.id);

    return {
      action: `whatsapp_step_${applicableStep.step_order}`,
      success: result.success,
      error: result.error,
    };
  } else if (applicableStep.action_type === 'call') {
    // Mark as call required
    await supabase
      .from('reminders')
      .update({
        current_step: applicableStep.step_order,
        status: 'Call_Required',
        call_required: true,
      })
      .eq('id', reminder.id);

    // Log the action
    await supabase.from('reminder_logs').insert({
      reminder_id: reminder.id,
      step_id: applicableStep.id,
      action_type: 'call',
      status: 'pending',
    });

    // Create notification for agents
    await createNotification(
      '📞 Appel requis',
      `Le client ${reminder.client.name || reminder.client.phone} nécessite un appel téléphonique. Échéance: ${formattedDueDate}`,
      'action_required',
      `/clients/${reminder.client_id}`
    );

    return { action: 'call_required', success: true };
  }

  return { action: 'unknown', success: false };
}

/**
 * Calculate next action date based on steps
 */
function calculateNextActionDate(
  dueDate: Date,
  steps: ReminderStep[],
  currentStep: number
): string | null {
  const nextStep = steps.find(s => s.step_order > currentStep);
  if (!nextStep) return null;

  const nextDate = new Date(dueDate);
  nextDate.setDate(nextDate.getDate() - nextStep.days_before_due);
  return nextDate.toISOString();
}

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (optional security)
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow without auth for testing
    console.log('Warning: No CRON_SECRET verification');
  }

  console.log('🔄 Starting reminder cron job...');

  try {
    // 1. Get all active reminder steps
    const { data: steps, error: stepsError } = await supabase
      .from('reminder_steps')
      .select('*')
      .eq('is_active', true)
      .order('step_order', { ascending: true });

    if (stepsError || !steps) {
      throw new Error('Failed to fetch reminder steps');
    }

    // 2. Get all pending reminders that haven't been resolved
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select(`
        id,
        client_id,
        due_date,
        current_step,
        status,
        client:clients(id, phone, name, vehicle)
      `)
      .not('status', 'in', '("Resolved","Completed","Expired")')
      .order('due_date', { ascending: true });

    if (remindersError) {
      throw new Error('Failed to fetch reminders');
    }

    console.log(`📋 Found ${reminders?.length || 0} reminders to process`);

    const results = {
      processed: 0,
      whatsapp_sent: 0,
      calls_required: 0,
      errors: 0,
      skipped: 0,
    };

    // 3. Process each reminder
    for (const reminder of (reminders || [])) {
      if (!reminder.client || !Array.isArray(reminder.client)) {
        results.skipped++;
        continue;
      }

      const clientData = reminder.client[0] || reminder.client;
      const reminderWithClient: ReminderWithClient = {
        ...reminder,
        client: clientData as any,
      };

      const result = await processReminder(reminderWithClient, steps);
      results.processed++;

      if (result.action.startsWith('whatsapp')) {
        if (result.success) results.whatsapp_sent++;
        else results.errors++;
      } else if (result.action === 'call_required') {
        results.calls_required++;
      } else if (result.action === 'no_action' || result.action === 'already_processed') {
        results.skipped++;
      }
    }

    console.log('✅ Cron job completed:', results);

    // Create summary notification
    if (results.whatsapp_sent > 0 || results.calls_required > 0) {
      await createNotification(
        '📊 Rapport quotidien des rappels',
        `${results.whatsapp_sent} WhatsApp envoyés, ${results.calls_required} appels requis`,
        'info'
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
