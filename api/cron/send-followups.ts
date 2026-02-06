/**
 * Cron job for sending follow-up "assistance" messages
 * 
 * This cron sends a follow-up message asking:
 * "Souhaitez-vous qu'on vous appelle pour vous assister dans la prise de votre prochain rendez-vous?"
 * 
 * CONDITIONS for sending:
 * 1. First reminder was sent 2+ hours ago
 * 2. First reminder was marked "read" by WhatsApp
 * 3. Current time is between 9h and 19h (Paris time)
 * 4. Status is "Reminder1_sent"
 * 5. follow_up_sent is FALSE
 * 
 * Schedule: Every hour at :30 between 9h-18h Paris time
 * Cron expression: "30 8-17 * * *" (UTC = Paris - 1h in winter, -2h in summer)
 * 
 * RESPONSE HANDLING (in webhook.ts):
 * - "Oui, appelez-moi" → status = 'To_be_called', exit workflow
 * - "Non merci" → status = 'Onhold' (agent decides next step)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WHATSAPP_API_TOKEN = process.env.VITE_WHATSAPP_API_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.VITE_WHATSAPP_PHONE_ID || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Template name for the follow-up message
const FOLLOWUP_TEMPLATE_NAME = 'assistance_rdv';

// Minimum hours since first message was sent
const MIN_HOURS_SINCE_SENT = 2;

// Business hours (Paris time) - Mon-Fri 9h-17h only
// Weekend reads are queued and sent Monday morning automatically
const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 17;

interface FollowUpCandidate {
  reminder_id: string;
  client_id: string;
  client_phone: string;
  client_name: string | null;
  message_id: string;
  message_sent_at: string;
  message_read_at: string | null;
}

/**
 * Check if current time is within business hours (Paris time)
 */
function isWithinBusinessHours(): boolean {
  const now = new Date();
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const hour = parisTime.getHours();
  
  console.log(`🕐 Paris time: ${parisTime.toLocaleTimeString('fr-FR')} (hour: ${hour})`);
  
  return hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;
}

/**
 * Find candidates for follow-up messages
 * 
 * Query logic:
 * - reminders with status = 'Reminder1_sent'
 * - follow_up_sent = FALSE
 * - client has whatsapp_available = TRUE
 * - has a message with status = 'read'
 * - message was sent 2+ hours ago
 */
async function findFollowUpCandidates(): Promise<FollowUpCandidate[]> {
  const twoHoursAgo = new Date(Date.now() - MIN_HOURS_SINCE_SENT * 60 * 60 * 1000).toISOString();
  
  console.log(`🔍 Looking for follow-up candidates (messages sent before ${twoHoursAgo})`);

  // Step 1: Get reminders that are candidates
  const { data: reminders, error: remindersError } = await supabase
    .from('reminders')
    .select(`
      id,
      client_id,
      clients!inner (
        id,
        phone,
        name,
        whatsapp_available
      )
    `)
    .eq('status', 'Reminder1_sent')
    .eq('follow_up_sent', false)
    .eq('clients.whatsapp_available', true);

  if (remindersError) {
    console.error('❌ Error fetching reminders:', remindersError);
    return [];
  }

  if (!reminders || reminders.length === 0) {
    console.log('📭 No reminders in Reminder1_sent status with follow_up_sent=false');
    return [];
  }

  console.log(`📋 Found ${reminders.length} potential reminders`);

  const candidates: FollowUpCandidate[] = [];

  // Step 2: For each reminder, check if there's a read message sent 2+ hours ago
  for (const reminder of reminders) {
    const client = (reminder as any).clients;
    if (!client?.phone) continue;

    // Clean phone number for matching
    const cleanPhone = client.phone.replace(/[^\d]/g, '');

    // Find the conversation for this client
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', client.id)
      .single();

    if (!conversation) {
      console.log(`⚠️ No conversation found for client ${client.id}`);
      continue;
    }

    // Find outbound template message that is marked as 'read' and sent 2+ hours ago
    const { data: message } = await supabase
      .from('messages')
      .select('id, created_at, status')
      .eq('conversation_id', conversation.id)
      .eq('direction', 'outbound')
      .eq('message_type', 'template')
      .eq('status', 'read')
      .lt('created_at', twoHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!message) {
      // Either message not read yet, or sent less than 2 hours ago
      continue;
    }

    // Check if client has responded (any inbound message after our message)
    const { data: inboundMessages, error: inboundError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation.id)
      .eq('direction', 'inbound')
      .gt('created_at', message.created_at)
      .limit(1);

    if (inboundError) {
      console.error(`❌ Error checking inbound messages for client ${client.id}:`, inboundError);
      continue;
    }

    if (inboundMessages && inboundMessages.length > 0) {
      // Client has already responded, skip
      console.log(`⏭️ Client ${client.name || client.phone} has already responded, skipping`);
      continue;
    }

    candidates.push({
      reminder_id: reminder.id,
      client_id: client.id,
      client_phone: client.phone,
      client_name: client.name,
      message_id: message.id,
      message_sent_at: message.created_at,
      message_read_at: null, // We know it's read but don't have exact timestamp
    });
  }

  console.log(`✅ Found ${candidates.length} candidates for follow-up`);
  return candidates;
}

/**
 * Send follow-up WhatsApp template
 */
async function sendFollowUpMessage(
  phone: string,
  clientName?: string | null
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    return { success: false, error: 'Missing WhatsApp credentials' };
  }

  const cleanedPhone = phone.replace(/[^\d]/g, '');

  console.log(`📤 Sending follow-up to ${cleanedPhone} (${clientName || 'Unknown'})`);

  try {
    // Build request body
    // The template 'assistance_rdv' should be a simple template with Quick Reply buttons
    // configured directly in Meta Business Manager
    const requestBody: any = {
      messaging_product: 'whatsapp',
      to: cleanedPhone,
      type: 'template',
      template: {
        name: FOLLOWUP_TEMPLATE_NAME,
        language: { code: 'fr' },
      },
    };

    // If template supports a name variable, add it
    if (clientName) {
      requestBody.template.components = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: clientName },
          ],
        },
      ];
    }

    const response = await fetch(
      `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'API Error' };
    }

    console.log('✅ Follow-up message sent:', data.messages?.[0]?.id);
    return { success: true, messageId: data.messages?.[0]?.id };

  } catch (error) {
    console.error('❌ WhatsApp send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Mark reminder as follow-up sent and create conversation/message record
 */
async function recordFollowUp(
  reminderId: string,
  clientId: string,
  phone: string,
  waMessageId: string | undefined
): Promise<void> {
  // Update reminder
  const { error: updateError } = await supabase
    .from('reminders')
    .update({
      follow_up_sent: true,
      follow_up_sent_at: new Date().toISOString(),
    })
    .eq('id', reminderId);

  if (updateError) {
    console.error('❌ Error updating reminder:', updateError);
  }

  // Find or create conversation
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_id', clientId)
    .single();

  if (conversation) {
    // Create message record
    const messageContent = 'Bonjour ! Suite à notre précédent message, souhaitez-vous qu\'on vous appelle pour vous assister dans la prise de votre prochain rendez-vous ?';
    
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        wa_message_id: waMessageId || null,
        from_phone: '33767668396', // WhatsApp Business number
        to_phone: phone.replace(/[^\d]/g, ''),
        direction: 'outbound',
        message_type: 'template',
        template_name: FOLLOWUP_TEMPLATE_NAME,
        content: messageContent,
        status: 'sent',
      });

    if (msgError) {
      console.error('❌ Error creating message record:', msgError);
    }

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message: messageContent.substring(0, 100),
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversation.id);
  }
}

/**
 * Create notification for admins about follow-up batch
 */
async function notifyAdmins(count: number): Promise<void> {
  if (count === 0) return;

  const { data: admins } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['admin', 'superadmin']);

  if (!admins || admins.length === 0) return;

  const notifications = admins.map(admin => ({
    user_id: admin.id,
    title: '📞 Follow-up envoyés',
    message: `${count} message(s) "Souhaitez-vous qu'on vous appelle?" envoyé(s) aux clients ayant lu leur relance.`,
    type: 'info',
    link: '/todo',
  }));

  await supabase.from('notifications').insert(notifications);
}

/**
 * Main handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  console.log('🚀 Follow-up cron started at:', new Date().toISOString());

  // Verify cron secret (optional, for security)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('⚠️ Unauthorized cron request');
    // Don't block - Vercel cron doesn't always send auth header
  }

  // Check business hours
  if (!isWithinBusinessHours()) {
    console.log('🌙 Outside business hours (9h-19h Paris), skipping');
    return res.status(200).json({
      success: true,
      message: 'Outside business hours',
      sent: 0,
    });
  }

  try {
    // Find candidates
    const candidates = await findFollowUpCandidates();

    if (candidates.length === 0) {
      console.log('📭 No follow-up candidates found');
      return res.status(200).json({
        success: true,
        message: 'No candidates for follow-up',
        sent: 0,
      });
    }

    console.log(`📤 Sending ${candidates.length} follow-up message(s)...`);

    let sentCount = 0;
    let failedCount = 0;

    for (const candidate of candidates) {
      // Send the message
      const result = await sendFollowUpMessage(candidate.client_phone, candidate.client_name);

      if (result.success) {
        sentCount++;
        // Record in database
        await recordFollowUp(
          candidate.reminder_id,
          candidate.client_id,
          candidate.client_phone,
          result.messageId
        );
        console.log(`✅ Sent follow-up to ${candidate.client_name || candidate.client_phone}`);
      } else {
        failedCount++;
        console.error(`❌ Failed to send follow-up to ${candidate.client_phone}: ${result.error}`);
      }

      // Delay between messages to avoid rate limiting (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Notify admins
    await notifyAdmins(sentCount);

    console.log(`✅ Follow-up cron completed: ${sentCount} sent, ${failedCount} failed`);

    return res.status(200).json({
      success: true,
      message: `Follow-up messages sent`,
      sent: sentCount,
      failed: failedCount,
      total: candidates.length,
    });

  } catch (error) {
    console.error('❌ Follow-up cron error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
