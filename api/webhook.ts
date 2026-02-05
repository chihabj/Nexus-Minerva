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
  const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
  
  // Try to find existing conversation (check both formats: with and without +)
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .or(`client_phone.eq.${cleanPhone},client_phone.eq.${phoneWithPlus}`)
    .limit(1)
    .single();

  if (existing) {
    console.log(`✅ Found existing conversation for ${phone}: ${existing.id}`);
    return existing;
  }

  // Try to find client by phone (check both formats)
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, phone')
    .or(`phone.eq.${cleanPhone},phone.eq.${phoneWithPlus}`)
    .limit(1)
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
 * If no client exists, create one with a To_be_contacted reminder
 */
async function handleClientResponse(phone: string, content: string, clientId: string | null, contactName?: string) {
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
  
  // If no client exists, create one and a reminder for TodoList
  if (!actualClientId) {
    console.log('📝 Creating new client for unknown number:', cleanPhone);
    
    // Create a new client
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        phone: cleanPhone,
        name: contactName || cleanPhone,
        status: 'New',
      })
      .select('id')
      .single();
    
    if (clientError || !newClient) {
      console.error('❌ Error creating client:', clientError);
      return;
    }
    
    actualClientId = newClient.id;
    console.log('✅ New client created:', actualClientId);
    
    // Create a reminder with To_be_contacted status for TodoList
    const { error: reminderError } = await supabase
      .from('reminders')
      .insert({
        client_id: actualClientId,
        status: 'To_be_contacted',
        due_date: new Date().toISOString().split('T')[0], // Today
        reminder_date: new Date().toISOString().split('T')[0],
        message: `Message entrant: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
        current_step: 0,
      });
    
    if (reminderError) {
      console.error('❌ Error creating reminder:', reminderError);
    } else {
      console.log('✅ Reminder created for TodoList (To_be_contacted)');
    }
    
    // Update the conversation with the client_id
    await supabase
      .from('conversations')
      .update({ client_id: actualClientId, client_name: contactName || cleanPhone })
      .eq('client_phone', cleanPhone);
    
    // Notify admins - link to conversation
    await createNotificationForAdmins(
      '🆕 Nouveau contact WhatsApp',
      `Message de ${contactName || cleanPhone}: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}" - À traiter dans la TodoList`,
      'action_required',
      `/inbox?phone=${encodeURIComponent(cleanPhone)}`
    );
    
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
    
    // Create notification for agents - action required - link to conversation
    await createNotificationForAdmins(
      '⏸️ Réponse client - Action requise',
      `Le client a répondu: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}" - Veuillez traiter ce dossier.`,
      'action_required',
      `/inbox?phone=${encodeURIComponent(cleanPhone)}`
    );
  } else {
    // No active reminders found, just notify - link to conversation
    await createNotificationForAdmins(
      '💬 Réponse client',
      `Nouveau message du client: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
      'info',
      `/inbox?phone=${encodeURIComponent(cleanPhone)}`
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
  // Note: unread_count is automatically incremented by database trigger for inbound messages
  await supabase
    .from('conversations')
    .update({ 
      last_message: messageContent?.substring(0, 100) || `[${message.type}]`,
      last_message_at: new Date().toISOString(),
      // Don't set unread_count here - let the database trigger handle it
    })
    .eq('id', conversationId);
  
  // Process the response for appointment detection / create task for unknown numbers
  if (messageContent) {
    await handleClientResponse(message.from, messageContent, clientId || null, contactName);
  }
  
  // Create notification for all admins - link to the specific conversation
  const cleanedFromPhone = message.from.startsWith('+') ? message.from.substring(1) : message.from;
  await createNotificationForAdmins(
    '💬 Nouveau message WhatsApp',
    `${contactName || message.from}: ${messageContent?.substring(0, 50) || `[${message.type}]`}`,
    'info',
    `/inbox?phone=${encodeURIComponent(cleanedFromPhone)}`
  );
  
  return data;
}

/**
 * Update message status (sent/delivered/read/failed)
 */
async function updateMessageStatus(
  waMessageId: string, 
  status: string, 
  errors?: Array<{ code: number; title: string }>,
  recipientPhone?: string
) {
  // Update message status
  const updateData: any = { status };
  
  // If failed, add error message
  if (status === 'failed' && errors && errors.length > 0) {
    updateData.error_message = errors.map(e => `[${e.code}] ${e.title}`).join('; ');
  }

  const { data: message, error } = await supabase
    .from('messages')
    .update(updateData)
    .eq('wa_message_id', waMessageId)
    .select('id, conversation_id, template_name')
    .single();

  if (error) {
    console.error('Error updating message status:', error);
    return;
  }
  
  console.log(`✅ Message ${waMessageId} status updated to ${status}`);

  // Si le message a échoué, analyser le type d'erreur
  if (status === 'failed' && message) {
    const errorText = errors?.map(e => `[${e.code}] ${e.title}`).join('; ') || 'Erreur inconnue';
    
    console.log(`🔍 Processing failed message. Errors:`, JSON.stringify(errors));
    
    // Codes d'erreur qui signifient "numéro sans WhatsApp" (désactiver définitivement)
    const noWhatsAppCodes = [131026]; // Message undeliverable
    
    // Codes d'erreur temporaires (spam protection, rate limiting) - ne pas désactiver
    const temporaryCodes = [131049, 131047, 131048]; // Ecosystem engagement, rate limits
    
    // Convert error codes to numbers for comparison (Meta sometimes sends strings)
    const hasNoWhatsApp = errors?.some(e => noWhatsAppCodes.includes(Number(e.code)));
    const isTemporaryError = errors?.some(e => temporaryCodes.includes(Number(e.code)));
    
    console.log(`🔍 hasNoWhatsApp: ${hasNoWhatsApp}, isTemporaryError: ${isTemporaryError}`);
    
    // Trouver le client via la conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('client_id, client_phone, client_name')
      .eq('id', message.conversation_id)
      .single();

    console.log(`🔍 Conversation found:`, conversation ? `client_id=${conversation.client_id}` : 'NOT FOUND');
    
    if (conversation?.client_id) {
      // Seulement si c'est une erreur définitive (pas de WhatsApp)
      if (hasNoWhatsApp) {
        console.log(`🔍 Looking for reminder with client_id=${conversation.client_id}`);
        
        // Mettre à jour le reminder en "To_be_called"
        // Note: On inclut 'Pending' car le webhook peut arriver AVANT que l'import ait fini de mettre à jour le status
        const { data: reminder, error: reminderError } = await supabase
          .from('reminders')
          .select('id, status')
          .eq('client_id', conversation.client_id)
          .in('status', ['Pending', 'Reminder1_sent', 'Reminder2_sent', 'Reminder3_sent'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        console.log(`🔍 Reminder found:`, reminder ? `id=${reminder.id}, status=${reminder.status}` : `NOT FOUND (error: ${reminderError?.message})`);

        if (reminder) {
          await supabase
            .from('reminders')
            .update({ 
              status: 'To_be_called',
              call_required: true,
              message: `WhatsApp non délivré: ${errorText} - Appel requis`
            })
            .eq('id', reminder.id);

          console.log(`⚠️ Reminder ${reminder.id} marked as To_be_called (no WhatsApp)`);
        }

        // Ajouter une note système
        await supabase
          .from('client_notes')
          .insert({
            client_id: conversation.client_id,
            content: `❌ Numéro sans WhatsApp\n• Destinataire: ${conversation.client_phone}\n• Erreur: ${errorText}\n• Action: WhatsApp désactivé, appel requis`,
            author: 'Système',
            note_type: 'system',
          });

        // Désactiver WhatsApp pour ce client
        await supabase
          .from('clients')
          .update({ whatsapp_available: false })
          .eq('id', conversation.client_id);

        console.log(`📝 WhatsApp disabled for client ${conversation.client_id} (no WhatsApp)`);
        
      } else if (isTemporaryError) {
        // Erreur temporaire - juste une note, ne pas désactiver WhatsApp
        console.log(`⚠️ Temporary delivery error for ${conversation.client_phone}: ${errorText}`);
        
        await supabase
          .from('client_notes')
          .insert({
            client_id: conversation.client_id,
            content: `⚠️ Message WhatsApp non délivré (temporaire)\n• Destinataire: ${conversation.client_phone}\n• Erreur: ${errorText}\n• Cause: Protection anti-spam Meta - Réessayer plus tard`,
            author: 'Système',
            note_type: 'system',
          });
      } else {
        // Autre erreur - noter mais ne pas désactiver
        console.log(`⚠️ Unknown delivery error for ${conversation.client_phone}: ${errorText}`);
      }
    }
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

        // Process status updates (sent, delivered, read, failed)
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            console.log(`📊 Status update for ${status.id}: ${status.status}${status.errors ? ` - Errors: ${JSON.stringify(status.errors)}` : ''}`);
            await updateMessageStatus(status.id, status.status, status.errors, status.recipient_id);
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
