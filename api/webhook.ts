/**
 * WhatsApp Webhook for Vercel Serverless Functions
 * 
 * This endpoint handles:
 * 1. Webhook verification (GET request from Meta)
 * 2. Incoming messages (POST requests from Meta)
 * 
 * Environment variables needed:
 * - WHATSAPP_VERIFY_TOKEN: Your custom verify token for webhook setup
 * - SUPABASE_URL: Your Supabase project URL
 * - SUPABASE_SERVICE_KEY: Your Supabase service role key (for server-side operations)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role key for server-side operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'nexus_webhook_verify_2024';
const OUR_PHONE_NUMBER = process.env.WHATSAPP_PHONE_NUMBER || '33767668396'; // Without +

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Type definitions for WhatsApp webhook payloads
interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'reaction' | 'sticker' | 'button' | 'interactive';
  text?: { body: string };
  button?: { text: string; payload: string }; // Quick Reply button click
  interactive?: { 
    type: string;
    button_reply?: { id: string; title: string }; // Interactive button reply
    list_reply?: { id: string; title: string; description?: string }; // List reply
  };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; mime_type: string; sha256: string; filename: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  reaction?: { message_id: string; emoji: string };
}

interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string }>;
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: WhatsAppMessage[];
      statuses?: WhatsAppStatus[];
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

/**
 * GET handler - Webhook verification
 */
async function handleVerification(req: VercelRequest, res: VercelResponse) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📥 Webhook verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    return res.status(200).send(challenge);
  } else {
    console.error('❌ Webhook verification failed');
    return res.status(403).json({ error: 'Verification failed' });
  }
}

/**
 * Find or create a conversation for a phone number
 */
async function getOrCreateConversation(phone: string, contactName?: string) {
  // Clean phone number (remove + if present)
  const cleanPhone = phone.startsWith('+') ? phone.substring(1) : phone;
  
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('client_phone', cleanPhone)
    .single();

  if (existing) {
    return existing;
  }

  // Try to find client by phone
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, phone')
    .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
    .single();

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from('conversations')
    .insert({
      client_id: client?.id || null,
      client_phone: cleanPhone,
      client_name: contactName || client?.name || null,
      status: 'open',
      unread_count: 0,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }

  return newConversation;
}

/**
 * Keywords that indicate a positive response (appointment booked)
 */
const POSITIVE_KEYWORDS = [
  'rdv', 'rendez-vous', 'rendezvous', 'rendez vous',
  'ok', 'oui', 'yes', 'd\'accord', 'daccord', 'accord',
  'confirmé', 'confirme', 'confirmer', 'confirmation',
  'réservé', 'reserve', 'réservation', 'reservation',
  'pris', 'prendre', 'je prends',
  'parfait', 'super', 'excellent', 'génial',
  'merci', 'bien reçu', 'noté',
  'je viens', 'je viendrai', 'je passerai',
  'c\'est bon', 'c bon', 'cest bon',
];

/**
 * Check if message content indicates appointment confirmation
 */
function isAppointmentConfirmation(content: string): boolean {
  if (!content) return false;
  
  const normalizedContent = content
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
  
  return POSITIVE_KEYWORDS.some(keyword => {
    const normalizedKeyword = keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normalizedContent.includes(normalizedKeyword);
  });
}

/**
 * NEW WORKFLOW STATUS:
 * - Any client response → status becomes 'Onhold' (stops automated reminders)
 * - Agent manually decides: Appointment_confirmed, To_be_contacted, Closed
 */

/**
 * Find client and update reminder status when client responds
 * ANY response puts the reminder on hold for agent review
 */
async function handleClientResponse(phone: string, content: string, clientId: string | null) {
  const cleanPhone = phone.startsWith('+') ? phone.substring(1) : phone;
  
  // Find client by phone if not already known
  let actualClientId = clientId;
  if (!actualClientId) {
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .single();
    
    actualClientId = client?.id || null;
  }
  
  if (!actualClientId) {
    console.log('⚠️ No client found for phone:', cleanPhone);
    return;
  }
  
  // ANY response puts the reminder on hold
  // Statuses that should be put on hold (active workflow statuses)
  const activeStatuses = ['New', 'Pending', 'Reminder1_sent', 'Reminder2_sent', 'Reminder3_sent', 'To_be_called'];
  
  console.log('📬 Client response received, setting reminders to Onhold...');
  
  // Update all active reminders for this client to Onhold
  const { data: updatedReminders, error } = await supabase
    .from('reminders')
    .update({ 
      status: 'Onhold',
      response_received_at: new Date().toISOString(),
    })
    .eq('client_id', actualClientId)
    .in('status', activeStatuses)
    .select();
  
  if (error) {
    console.error('Error updating reminders to Onhold:', error);
  } else if (updatedReminders && updatedReminders.length > 0) {
    console.log(`✅ Set ${updatedReminders.length} reminders to Onhold`);
    
    // Log the response in reminder_logs
    for (const reminder of updatedReminders) {
      await supabase.from('reminder_logs').insert({
        reminder_id: reminder.id,
        action_type: 'whatsapp',
        status: 'delivered',
        response_received: true,
        response_text: content.substring(0, 500),
      });
    }
    
    // Create notification for agents - action required
    await createNotificationForAdmins(
      '⏸️ Réponse client - Action requise',
      `Le client a répondu: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}" - Veuillez traiter ce dossier.`,
      'action_required',
      `/clients/${actualClientId}`
    );
  } else {
    // No active reminders found, just notify
    await createNotificationForAdmins(
      '💬 Réponse client',
      `Nouveau message du client: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      'info',
      `/inbox`
    );
  }
}

/**
 * Create notification for all admin/superadmin users
 */
async function createNotificationForAdmins(
  title: string,
  message: string,
  type: 'info' | 'warning' | 'success' | 'action_required',
  link?: string
) {
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
    console.log(`📢 Created ${notifications.length} notifications`);
  }
}

/**
 * Save an incoming message to the database
 */
async function saveIncomingMessage(
  conversationId: string,
  message: WhatsAppMessage,
  contactName?: string,
  clientId?: string | null
) {
  // Extract message content from various message types
  const messageContent = 
    message.text?.body ||                           // Regular text message
    message.button?.text ||                         // Quick Reply button click
    message.interactive?.button_reply?.title ||     // Interactive button reply
    message.interactive?.list_reply?.title ||       // List reply
    message.image?.caption || 
    message.document?.caption || 
    message.video?.caption || 
    null;
  
  console.log('📝 Extracting content from message type:', message.type, '| Content:', messageContent);
  
  const messageData = {
    conversation_id: conversationId,
    wa_message_id: message.id,
    from_phone: message.from,
    to_phone: OUR_PHONE_NUMBER,
    direction: 'inbound' as const,
    message_type: message.type,
    content: messageContent,
    media_url: null, // TODO: Download media and store URL
    status: 'delivered' as const,
    metadata: {
      timestamp: message.timestamp,
      contact_name: contactName,
      ...(message.image && { image: message.image }),
      ...(message.document && { document: message.document }),
      ...(message.audio && { audio: message.audio }),
      ...(message.video && { video: message.video }),
      ...(message.location && { location: message.location }),
      ...(message.reaction && { reaction: message.reaction }),
    },
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(messageData)
    .select()
    .single();

  if (error) {
    console.error('Error saving message:', error);
    throw error;
  }

  console.log('✅ Message saved:', data.id);
  
  // Update conversation with last message
  await supabase
    .from('conversations')
    .update({ 
      last_message: messageContent?.substring(0, 100) || `[${message.type}]`,
      last_message_at: new Date().toISOString(),
      unread_count: 1
    })
    .eq('id', conversationId);
  
  // Process the response for appointment detection
  if (messageContent) {
    await handleClientResponse(message.from, messageContent, clientId || null);
  }
  
  // Create notification for all admins
  await createNotificationForAdmins(
    '💬 Nouveau message WhatsApp',
    `${contactName || message.from}: ${messageContent?.substring(0, 50) || `[${message.type}]`}`,
    'info',
    '/inbox'
  );
  
  return data;
}

/**
 * Update message status (sent/delivered/read)
 */
async function updateMessageStatus(waMessageId: string, status: string) {
  const { error } = await supabase
    .from('messages')
    .update({ status })
    .eq('wa_message_id', waMessageId);

  if (error) {
    console.error('Error updating message status:', error);
  } else {
    console.log(`✅ Message ${waMessageId} status updated to ${status}`);
  }
}

/**
 * POST handler - Process incoming messages and status updates
 */
async function handleIncomingWebhook(req: VercelRequest, res: VercelResponse) {
  try {
    const payload = req.body as WhatsAppWebhookPayload;
    
    console.log('📥 Incoming webhook:', JSON.stringify(payload, null, 2));

    if (payload.object !== 'whatsapp_business_account') {
      return res.status(400).json({ error: 'Invalid webhook object' });
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Process incoming messages
        if (value.messages && value.messages.length > 0) {
          const contactName = value.contacts?.[0]?.profile?.name;
          
          for (const message of value.messages) {
            console.log(`📩 New message from ${message.from}: ${message.text?.body || `[${message.type}]`}`);
            
            // Get or create conversation
            const conversation = await getOrCreateConversation(message.from, contactName);
            
            // Save the message and process for appointment detection
            await saveIncomingMessage(conversation.id, message, contactName, conversation.client_id);
          }
        }

        // Process status updates (sent, delivered, read)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📊 Status update for ${status.id}: ${status.status}`);
            await updateMessageStatus(status.id, status.status);
          }
        }
      }
    }

    // Always respond with 200 to acknowledge receipt
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    // Still return 200 to prevent Meta from retrying
    return res.status(200).json({ success: false, error: 'Internal error' });
  }
}

/**
 * Main handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleVerification(req, res);
  }

  if (req.method === 'POST') {
    return handleIncomingWebhook(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
